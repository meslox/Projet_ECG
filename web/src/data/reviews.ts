import {
  addDoc, collection, getDocs, query, serverTimestamp, where, type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ReviewStatus } from '../types'

export interface PrivateNote {
  id: string
  doctorUid: string
  note: string
  createdAt: Timestamp
}

function reviewsPath(patientUid: string, recordingId: string) {
  return collection(db, 'patients', patientUid, 'recordings', recordingId, 'reviews')
}

function notesPath(patientUid: string, recordingId: string) {
  return collection(db, 'patients', patientUid, 'recordings', recordingId, 'privateNotes')
}

export async function addReview(
  patientUid: string,
  recordingId: string,
  doctorUid: string,
  status: ReviewStatus,
  finding: string,
): Promise<void> {
  await addDoc(reviewsPath(patientUid, recordingId), {
    doctorUid,
    status,
    finding,
    createdAt: serverTimestamp(),
  })
}

export async function addPrivateNote(
  patientUid: string,
  recordingId: string,
  doctorUid: string,
  note: string,
): Promise<void> {
  await addDoc(notesPath(patientUid, recordingId), {
    doctorUid,
    note,
    createdAt: serverTimestamp(),
  })
}

// Filtered by doctorUid (the rules require it) and sorted in the browser, which avoids needing
// a composite Firestore index.
export async function listMyPrivateNotes(
  patientUid: string,
  recordingId: string,
  doctorUid: string,
): Promise<PrivateNote[]> {
  const snap = await getDocs(
    query(notesPath(patientUid, recordingId), where('doctorUid', '==', doctorUid)),
  )
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PrivateNote, 'id'>) }))
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}
