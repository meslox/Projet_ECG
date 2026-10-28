import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export interface Grant {
  id: string
  patientUid: string
  doctorUid: string
  status: 'active' | 'revoked'
  patientName: string
  grantedAt?: Timestamp
  revokedAt?: Timestamp
}

export interface GrantWithDoctor extends Grant {
  doctorName: string
}

export interface DoctorEntry {
  uid: string
  displayName: string
}

export async function findDoctorByCode(code: string): Promise<DoctorEntry | null> {
  const snap = await getDoc(doc(db, 'doctorDirectory', code))
  if (!snap.exists()) return null
  const data = snap.data()
  if (typeof data.uid !== 'string') return null
  return { uid: data.uid, displayName: String(data.displayName ?? 'Doctor') }
}

// Doctor names come from the admin-managed directory, not from anything the patient typed.
export async function listGrantsWithDoctors(patientUid: string): Promise<GrantWithDoctor[]> {
  const snap = await getDocs(query(collection(db, 'grants'), where('patientUid', '==', patientUid)))
  const grants = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Grant, 'id'>) }))
  const named = await Promise.all(
    grants.map(async (g) => {
      const dir = await getDocs(
        query(collection(db, 'doctorDirectory'), where('uid', '==', g.doctorUid), limit(1)),
      )
      const name = dir.docs[0]?.data().displayName
      return { ...g, doctorName: typeof name === 'string' ? name : 'Unknown doctor' }
    }),
  )
  return named.sort((a, b) => a.doctorName.localeCompare(b.doctorName))
}

// `existing` comes from the loaded list: reading a grant that does not exist is denied by the rules.
export async function authorizeDoctor(
  patientUid: string,
  patientName: string,
  doctorUid: string,
  existing?: Grant,
): Promise<void> {
  if (existing) {
    const ref = doc(db, 'grants', existing.id)
    if (existing.patientName !== patientName) {
      await updateDoc(ref, { patientName })
    }
    await updateDoc(ref, { status: 'active', grantedAt: serverTimestamp() })
    return
  }
  await setDoc(doc(db, 'grants', `${patientUid}_${doctorUid}`), {
    patientUid,
    doctorUid,
    status: 'active',
    patientName,
    grantedAt: serverTimestamp(),
  })
}

export async function revokeGrant(grantId: string): Promise<void> {
  await updateDoc(doc(db, 'grants', grantId), {
    status: 'revoked',
    revokedAt: serverTimestamp(),
  })
}
