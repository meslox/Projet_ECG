import { collection, doc, getDoc, getDocs, query, where, type Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export interface PatientLink {
  patientUid: string
  patientName: string
  grantedAt?: Timestamp
}

export async function listAuthorisedPatients(doctorUid: string): Promise<PatientLink[]> {
  const q = query(
    collection(db, 'grants'),
    where('doctorUid', '==', doctorUid),
    where('status', '==', 'active'),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => {
      const data = d.data()
      return {
        patientUid: String(data.patientUid),
        patientName: String(data.patientName ?? 'Patient'),
        grantedAt: data.grantedAt as Timestamp | undefined,
      }
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName))
}

// Throws permission-denied if no grant exists (the rules cannot read a missing grant).
export async function getMyGrant(
  patientUid: string,
  doctorUid: string,
): Promise<{ status: string; patientName: string }> {
  const snap = await getDoc(doc(db, 'grants', `${patientUid}_${doctorUid}`))
  if (!snap.exists()) throw new Error('no grant')
  const data = snap.data()
  return { status: String(data.status), patientName: String(data.patientName ?? 'Patient') }
}
