// Seeds the LOCAL emulators with clearly-synthetic demo data.
// Refuses to run unless all emulator hosts are set and the project is a demo-* project.
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const PROJECT_ID = 'demo-ecg';
const BUCKET = 'demo-ecg.firebasestorage.app';
const THRESHOLD = 0.2571564335376024; // from model/export/af_model_card.json
const PASSWORD = 'Passw0rd!demo'; // local emulator only

for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  if (!process.env[v]) {
    console.error(`Refusing to run: ${v} is not set. This script only seeds local emulators.`);
    process.exit(1);
  }
}
if (!PROJECT_ID.startsWith('demo-')) {
  console.error('Refusing to run: project id must start with "demo-".');
  process.exit(1);
}

initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();

// ---------- synthetic ECG (not real data) ----------
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (x, mu, sigma, amp) => amp * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

function syntheticEcg({ fs, seconds, meanRr, jitter, seed }) {
  const rand = rng(seed);
  const n = Math.round(fs * seconds);
  const beats = [];
  for (let t = 0.5; t < seconds; t += meanRr * (1 + jitter * (rand() * 2 - 1))) beats.push(t);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const ts = i / fs;
    let v = 0;
    for (const b of beats) {
      const d = ts - b;
      if (d < -0.4 || d > 0.6) continue;
      v += gauss(d, -0.16, 0.025, 0.12) + gauss(d, -0.03, 0.01, -0.12)
        + gauss(d, 0, 0.012, 1.0) + gauss(d, 0.03, 0.01, -0.2) + gauss(d, 0.25, 0.045, 0.3);
    }
    out[i] = v + 0.01 * (rand() * 2 - 1);
  }
  return out;
}

// ---------- demo people ----------
const people = [
  { uid: 'demo-patient-1', email: 'patient1@example.test', name: 'Demo Patient One', role: 'patient' },
  { uid: 'demo-patient-2', email: 'patient2@example.test', name: 'Demo Patient Two', role: 'patient' },
  { uid: 'demo-doctor-1', email: 'doctor1@example.test', name: 'Dr. Demo One', role: 'doctor' },
  { uid: 'demo-doctor-2', email: 'doctor2@example.test', name: 'Dr. Demo Two', role: 'doctor' },
];

await auth.deleteUsers(people.map((p) => p.uid));
for (const p of people) {
  await auth.createUser({ uid: p.uid, email: p.email, password: PASSWORD, displayName: p.name });
  await db.doc(`users/${p.uid}`).set({
    displayName: p.name, role: p.role, createdAt: Timestamp.now(),
  });
}
await db.doc('doctorDirectory/DR-DEMO1').set({ uid: 'demo-doctor-1', displayName: 'Dr. Demo One' });
await db.doc('doctorDirectory/DR-DEMO2').set({ uid: 'demo-doctor-2', displayName: 'Dr. Demo Two' });

// Patient 1 authorises doctor 1 only. Doctor 2 and patient 2 have no access to patient 1.
await db.doc('grants/demo-patient-1_demo-doctor-1').set({
  patientUid: 'demo-patient-1', doctorUid: 'demo-doctor-1', status: 'active',
  patientName: 'Demo Patient One', grantedAt: Timestamp.now(),
});

// ---------- recordings ----------
const HOUR = 3600 * 1000;
const recordings = [
  { id: 'rec-demo-001', ageH: 48, meanRr: 0.85, jitter: 0.03, seed: 1, meanScore: 0.04, windowScores: [0.03, 0.05, 0.04] },
  { id: 'rec-demo-002', ageH: 24, meanRr: 0.8, jitter: 0.35, seed: 2, meanScore: 0.71, windowScores: [0.66, 0.74, 0.73] },
  { id: 'rec-demo-003', ageH: 1, meanRr: 0.9, jitter: 0.03, seed: 3, meanScore: 0.08, windowScores: [0.07, 0.09, 0.08] },
];
const FS = 300;
const SECONDS = 30;

for (const r of recordings) {
  const samples = syntheticEcg({ fs: FS, seconds: SECONDS, meanRr: r.meanRr, jitter: r.jitter, seed: r.seed });
  const csv = samples.map((v) => v.toFixed(5)).join('\n') + '\n';
  const gz = gzipSync(Buffer.from(csv));
  const storagePath = `ecg/demo-patient-1/${r.id}.csv.gz`;
  await bucket.file(storagePath).save(gz, { contentType: 'application/gzip' });

  const at = Timestamp.fromMillis(Date.now() - r.ageH * HOUR);
  await db.doc(`patients/demo-patient-1/recordings/${r.id}`).set({
    synthetic: true,
    deviceId: 'demo-device-1',
    recordedAt: at,
    uploadedAt: at,
    samplingRateHz: FS,
    analysisRateHz: 300,
    windowSec: 10,
    windowCount: r.windowScores.length,
    durationSec: SECONDS,
    storagePath,
    format: 'csv.gz',
    sizeBytes: gz.length,
    sha256: createHash('sha256').update(gz).digest('hex'),
    prediction: {
      task: 'normal_vs_af',
      label: r.meanScore >= THRESHOLD ? 'possible_af' : 'no_af_detected',
      meanScore: r.meanScore,
      threshold: THRESHOLD,
      windowScores: r.windowScores,
      modelId: 'SYNTHETIC-DEMO (no real model was run)',
      modelSha256: null,
      preprocessVersion: 'synthetic',
    },
    quality: { flatSegment: false },
    processingStatus: 'complete',
  });
}

// One demo clinician review and one private note, on the "possible AF" recording.
await db.doc('patients/demo-patient-1/recordings/rec-demo-002/reviews/rev-demo-1').set({
  doctorUid: 'demo-doctor-1', status: 'needs_followup',
  finding: 'Synthetic demo review: irregular rhythm, suggest follow-up.', createdAt: Timestamp.now(),
});
await db.doc('patients/demo-patient-1/recordings/rec-demo-002/privateNotes/note-demo-1').set({
  doctorUid: 'demo-doctor-1', note: 'Synthetic private note, visible only to this doctor.',
  createdAt: Timestamp.now(),
});

console.log('Seeded:', people.map((p) => p.email).join(', '));
console.log(`Password for all demo users: ${PASSWORD}`);
console.log(`Recordings: ${recordings.map((r) => r.id).join(', ')}`);
