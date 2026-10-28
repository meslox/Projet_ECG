import { readFileSync } from 'node:fs';
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, query, where, serverTimestamp,
} from 'firebase/firestore';

describe('firestore rules', () => {
  let env;

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-ecg',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
  });

  after(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/p1'), { role: 'patient', displayName: 'Patient One' });
      await setDoc(doc(db, 'users/p2'), { role: 'patient', displayName: 'Patient Two' });
      await setDoc(doc(db, 'users/d1'), { role: 'doctor', displayName: 'Doctor One' });
      await setDoc(doc(db, 'users/d2'), { role: 'doctor', displayName: 'Doctor Two' });
      await setDoc(doc(db, 'grants/p1_d1'), {
        patientUid: 'p1', doctorUid: 'd1', status: 'active', patientName: 'Patient One',
      });
      await setDoc(doc(db, 'patients/p1/recordings/r1'), {
        deviceId: 'dev1', synthetic: true, prediction: { label: 'no_af_detected', meanScore: 0.1 },
      });
      await setDoc(doc(db, 'patients/p1/recordings/r1/reviews/rv1'), {
        doctorUid: 'd1', status: 'reviewed', finding: 'ok',
      });
      await setDoc(doc(db, 'patients/p1/recordings/r1/privateNotes/n1'), {
        doctorUid: 'd1', note: 'private',
      });
      await setDoc(doc(db, 'deviceSecrets/dev1'), { hash: 'x' });
      await setDoc(doc(db, 'auditLogs/a1'), { event: 'x' });
    });
  });

  const as = (uid) => env.authenticatedContext(uid).firestore();
  const anon = () => env.unauthenticatedContext().firestore();

  describe('recordings', () => {
    it('denies unauthenticated reads', async () => {
      await assertFails(getDoc(doc(anon(), 'patients/p1/recordings/r1')));
    });
    it('lets a patient read their own recording', async () => {
      await assertSucceeds(getDoc(doc(as('p1'), 'patients/p1/recordings/r1')));
    });
    it('denies another patient', async () => {
      await assertFails(getDoc(doc(as('p2'), 'patients/p1/recordings/r1')));
    });
    it('lets an authorised doctor read', async () => {
      await assertSucceeds(getDoc(doc(as('d1'), 'patients/p1/recordings/r1')));
    });
    it('denies a doctor without a grant', async () => {
      await assertFails(getDoc(doc(as('d2'), 'patients/p1/recordings/r1')));
    });
    it('denies the doctor after the patient revokes', async () => {
      await assertSucceeds(updateDoc(doc(as('p1'), 'grants/p1_d1'), {
        status: 'revoked', revokedAt: serverTimestamp(),
      }));
      await assertFails(getDoc(doc(as('d1'), 'patients/p1/recordings/r1')));
    });
    it('denies all client writes to recordings', async () => {
      await assertFails(setDoc(doc(as('p1'), 'patients/p1/recordings/r9'), { x: 1 }));
      await assertFails(updateDoc(doc(as('d1'), 'patients/p1/recordings/r1'), { x: 1 }));
      await assertFails(deleteDoc(doc(as('p1'), 'patients/p1/recordings/r1')));
    });
  });

  describe('users', () => {
    it('lets a new user register as a patient', async () => {
      await assertSucceeds(setDoc(doc(as('p3'), 'users/p3'), {
        displayName: 'New Patient', role: 'patient', createdAt: serverTimestamp(),
      }));
    });
    it('denies self-registering as a doctor', async () => {
      await assertFails(setDoc(doc(as('p3'), 'users/p3'), {
        displayName: 'Fake Doctor', role: 'doctor', createdAt: serverTimestamp(),
      }));
    });
    it('denies changing your own role', async () => {
      await assertFails(updateDoc(doc(as('p1'), 'users/p1'), { role: 'doctor' }));
    });
    it('denies reading someone else\'s user doc', async () => {
      await assertFails(getDoc(doc(as('p1'), 'users/p2')));
    });
  });

  describe('grants', () => {
    const newGrant = (patientUid, doctorUid) => ({
      patientUid, doctorUid, status: 'active',
      patientName: 'Name', grantedAt: serverTimestamp(),
    });
    it('lets a patient grant a doctor', async () => {
      await assertSucceeds(setDoc(doc(as('p1'), 'grants/p1_d2'), newGrant('p1', 'd2')));
    });
    it('denies granting to a non-doctor', async () => {
      await assertFails(setDoc(doc(as('p1'), 'grants/p1_p2'), newGrant('p1', 'p2')));
    });
    it('denies creating a grant for another patient', async () => {
      await assertFails(setDoc(doc(as('p1'), 'grants/p2_d2'), newGrant('p2', 'd2')));
    });
    it('denies a doctor creating or changing grants', async () => {
      await assertFails(setDoc(doc(as('d2'), 'grants/p1_d2'), newGrant('p1', 'd2')));
      await assertFails(updateDoc(doc(as('d1'), 'grants/p1_d1'), {
        status: 'revoked', revokedAt: serverTimestamp(),
      }));
    });
    it('lets a doctor list their own grants, but not all grants', async () => {
      await assertSucceeds(getDocs(query(
        collection(as('d1'), 'grants'), where('doctorUid', '==', 'd1'))));
      await assertFails(getDocs(collection(as('d1'), 'grants')));
    });

    it('lets a patient revoke and then re-authorise the same doctor', async () => {
      const db = as('p1');
      await assertSucceeds(updateDoc(doc(db, 'grants/p1_d1'), {
        status: 'revoked', revokedAt: serverTimestamp(),
      }));
      await assertFails(getDoc(doc(as('d1'), 'patients/p1/recordings/r1')));
      await assertSucceeds(updateDoc(doc(db, 'grants/p1_d1'), {
        status: 'active', grantedAt: serverTimestamp(),
      }));
      await assertSucceeds(getDoc(doc(as('d1'), 'patients/p1/recordings/r1')));
    });
    it('denies a patient changing grant fields other than status and timestamps', async () => {
      await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), {
        doctorUid: 'd2', status: 'active', grantedAt: serverTimestamp(),
      }));
    });
    it('denies activating a grant without a fresh grantedAt', async () => {
      await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), { status: 'active' }));
    });
  });

  describe('reviews and private notes', () => {
    const review = (doctorUid) => ({
      doctorUid, status: 'reviewed', finding: 'Sinus rhythm', createdAt: serverTimestamp(),
    });
    it('lets an authorised doctor add a review', async () => {
      await assertSucceeds(setDoc(
        doc(as('d1'), 'patients/p1/recordings/r1/reviews/rv2'), review('d1')));
    });
    it('denies a doctor without a grant', async () => {
      await assertFails(setDoc(
        doc(as('d2'), 'patients/p1/recordings/r1/reviews/rv2'), review('d2')));
    });
    it('denies writing a review as another doctor', async () => {
      await assertFails(setDoc(
        doc(as('d1'), 'patients/p1/recordings/r1/reviews/rv2'), review('d2')));
    });
    it('denies a patient writing a review', async () => {
      await assertFails(setDoc(
        doc(as('p1'), 'patients/p1/recordings/r1/reviews/rv2'), review('p1')));
    });
    it('makes reviews append-only', async () => {
      await assertFails(updateDoc(
        doc(as('d1'), 'patients/p1/recordings/r1/reviews/rv1'), { finding: 'changed' }));
      await assertFails(deleteDoc(doc(as('d1'), 'patients/p1/recordings/r1/reviews/rv1')));
    });
    it('lets the patient read reviews but not other patients', async () => {
      await assertSucceeds(getDoc(doc(as('p1'), 'patients/p1/recordings/r1/reviews/rv1')));
      await assertFails(getDoc(doc(as('p2'), 'patients/p1/recordings/r1/reviews/rv1')));
    });
    it('keeps private notes visible only to their author', async () => {
      await assertSucceeds(getDoc(doc(as('d1'), 'patients/p1/recordings/r1/privateNotes/n1')));
      await assertFails(getDoc(doc(as('p1'), 'patients/p1/recordings/r1/privateNotes/n1')));
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'grants/p1_d2'), {
          patientUid: 'p1', doctorUid: 'd2', status: 'active', patientName: 'Patient One',
        });
      });
      await assertFails(getDoc(doc(as('d2'), 'patients/p1/recordings/r1/privateNotes/n1')));
    });
  });

  describe('server-only collections', () => {
    it('denies client access to deviceSecrets and auditLogs', async () => {
      await assertFails(getDoc(doc(as('p1'), 'deviceSecrets/dev1')));
      await assertFails(getDoc(doc(as('d1'), 'auditLogs/a1')));
      await assertFails(setDoc(doc(as('p1'), 'auditLogs/a2'), { event: 'x' }));
    });
  });
});
