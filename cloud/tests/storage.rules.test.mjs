import { readFileSync } from 'node:fs';
import { describe, it, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';

describe('storage rules', () => {
  let env;
  const FILE = 'ecg/p1/r1.csv.gz';

  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-ecg',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
  });

  after(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/p1'), { role: 'patient', displayName: 'Patient One' });
      await setDoc(doc(db, 'users/p2'), { role: 'patient', displayName: 'Patient Two' });
      await setDoc(doc(db, 'users/d1'), { role: 'doctor', displayName: 'Doctor One' });
      await setDoc(doc(db, 'users/d2'), { role: 'doctor', displayName: 'Doctor Two' });
      await setDoc(doc(db, 'grants/p1_d1'), {
        patientUid: 'p1', doctorUid: 'd1', status: 'active', patientName: 'Patient One',
      });
      await uploadString(ref(ctx.storage(), FILE), 'synthetic sample');
      await uploadString(ref(ctx.storage(), 'other/file.txt'), 'x');
    });
  });

  const as = (uid) => env.authenticatedContext(uid).storage();
  const anon = () => env.unauthenticatedContext().storage();

  it('denies unauthenticated reads', async () => {
    await assertFails(getBytes(ref(anon(), FILE)));
  });
  it('lets the owner read their file', async () => {
    await assertSucceeds(getBytes(ref(as('p1'), FILE)));
  });
  it('denies another patient', async () => {
    await assertFails(getBytes(ref(as('p2'), FILE)));
  });
  it('lets a doctor with an active grant read', async () => {
    await assertSucceeds(getBytes(ref(as('d1'), FILE)));
  });
  it('denies a doctor without a grant', async () => {
    await assertFails(getBytes(ref(as('d2'), FILE)));
  });
  it('denies the doctor after the grant is revoked', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'grants/p1_d1'), { status: 'revoked' });
    });
    await assertFails(getBytes(ref(as('d1'), FILE)));
  });
  it('denies all client uploads', async () => {
    await assertFails(uploadString(ref(as('p1'), 'ecg/p1/r2.csv.gz'), 'x'));
    await assertFails(uploadString(ref(as('d1'), 'ecg/p1/r3.csv.gz'), 'x'));
  });
  it('denies reads outside the ecg folder', async () => {
    await assertFails(getBytes(ref(as('p1'), 'other/file.txt')));
  });
});
