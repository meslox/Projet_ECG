import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const env = import.meta.env

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-ecg.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-ecg',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-ecg.firebasestorage.app',
  appId: env.VITE_FIREBASE_APP_ID ?? 'demo-app',
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// `npm run dev` only: talk to the local emulators, never the real project.
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}
