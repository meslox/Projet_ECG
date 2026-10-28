import { sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase'

// One atomic batch: the profile document plus the name copy on every ACTIVE grant.
// Removed grants keep the old name on purpose. (A batch holds up to 500 writes, far above
// the number of doctors one patient will authorise.)
export async function renamePatient(uid: string, newName: string): Promise<void> {
  const grants = await getDocs(query(collection(db, 'grants'), where('patientUid', '==', uid)))
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', uid), { displayName: newName })
  grants.forEach((g) => {
    if (g.data().status === 'active') batch.update(g.ref, { patientName: newName })
  })
  await batch.commit()
  if (auth.currentUser) {
    // Best effort: the Firestore profile above is what the app reads.
    await updateProfile(auth.currentUser, { displayName: newName }).catch(() => undefined)
  }
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}
