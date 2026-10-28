import { readFileSync } from 'node:fs';
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

describe('rename rules', () => {
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
      await setDoc(doc(db, 'users/d1'), { role: 'doctor', displayName: 'Doctor One' });
      await setDoc(doc(db, 'grants/p1_d1'), {
        patientUid: 'p1', doctorUid: 'd1', status: 'active', patientName: 'Patient One',
      });
    });
  });

  const as = (uid) => env.authenticatedContext(uid).firestore();

  it('lets a user change their own display name', async () => {
    await assertSucceeds(updateDoc(doc(as('p1'), 'users/p1'), { displayName: 'New Name' }));
  });

  it('denies empty or overlong display names', async () => {
    await assertFails(updateDoc(doc(as('p1'), 'users/p1'), { displayName: '' }));
    await assertFails(updateDoc(doc(as('p1'), 'users/p1'), { displayName: 'x'.repeat(81) }));
  });

  it('lets a patient rename themselves on their grant', async () => {
    await assertSucceeds(updateDoc(doc(as('p1'), 'grants/p1_d1'), { patientName: 'New Name' }));
  });

  it('denies a rename combined with any other field change', async () => {
    await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), {
      patientName: 'New Name', doctorUid: 'd2',
    }));
    await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), {
      patientName: 'New Name', status: 'revoked', revokedAt: serverTimestamp(),
    }));
  });

  it('denies empty or overlong names on a grant', async () => {
    await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), { patientName: '' }));
    await assertFails(updateDoc(doc(as('p1'), 'grants/p1_d1'), { patientName: 'x'.repeat(81) }));
  });

  it('denies a doctor renaming the patient on a grant', async () => {
    await assertFails(updateDoc(doc(as('d1'), 'grants/p1_d1'), { patientName: 'Hacked' }));
  });

  it('denies another patient renaming on someone else\'s grant', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/p2'), { role: 'patient', displayName: 'Patient Two' });
    });
    await assertFails(updateDoc(doc(as('p2'), 'grants/p1_d1'), { patientName: 'Hacked' }));
  });
});
