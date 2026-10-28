import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { getBytes, ref } from 'firebase/storage'
import { db, storage } from '../firebase'
import type { Recording, Review } from '../types'

// Firestore data is written only by trusted server code (security rules), so a cast is used here.
// Add runtime validation before this ever reads data from a less trusted source.

export async function listRecordings(patientUid: string, max = 50): Promise<Recording[]> {
  const q = query(
    collection(db, 'patients', patientUid, 'recordings'),
    orderBy('recordedAt', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Recording, 'id'>) }))
}

export async function getRecording(patientUid: string, recordingId: string): Promise<Recording | null> {
  const snap = await getDoc(doc(db, 'patients', patientUid, 'recordings', recordingId))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Recording, 'id'>) }
}

export async function listReviews(patientUid: string, recordingId: string): Promise<Review[]> {
  const q = query(
    collection(db, 'patients', patientUid, 'recordings', recordingId, 'reviews'),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Review, 'id'>) }))
}

// The ECG file is a gzipped, one-column CSV (same shape pi_af_inference.py reads).
export async function loadEcgSamples(storagePath: string): Promise<Float64Array> {
  const bytes = await getBytes(ref(storage, storagePath))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  const lines = text.split('\n')
  const out = new Float64Array(lines.length)
  let n = 0
  for (const line of lines) {
    if (line === '') continue
    const v = Number(line)
    if (!Number.isFinite(v)) throw new Error('Invalid ECG file')
    out[n++] = v
  }
  return out.subarray(0, n)
}
