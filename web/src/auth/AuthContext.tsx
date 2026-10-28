import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export type Role = 'patient' | 'doctor'
export interface Profile {
  displayName: string
  role: Role
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (displayName: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reloadProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.role !== 'patient' && data.role !== 'doctor') return null
  return { displayName: String(data.displayName ?? ''), role: data.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const registering = useRef(false)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      // During registration the profile document does not exist yet; register() sets state itself.
      if (registering.current) return
      if (u) {
        setLoading(true)
        const p = await loadProfile(u.uid).catch(() => null)
        setUser(u)
        setProfile(p)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function register(displayName: string, email: string, password: string) {
    registering.current = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      try {
        await updateProfile(cred.user, { displayName })
        // Public sign-up is always a patient; the security rules enforce this too.
        await setDoc(doc(db, 'users', cred.user.uid), {
          displayName,
          role: 'patient',
          createdAt: serverTimestamp(),
        })
      } catch (e) {
        await cred.user.delete().catch(() => undefined) // do not leave a half-created account
        throw e
      }
      setUser(cred.user)
      setProfile({ displayName, role: 'patient' })
      setLoading(false)
    } finally {
      registering.current = false
    }
  }

  async function logout() {
    await signOut(auth)
  }

  // Re-reads the profile document (used after the display name changes).
  async function reloadProfile() {
    const u = auth.currentUser
    if (!u) return
    const p = await loadProfile(u.uid).catch(() => undefined)
    if (p !== undefined) setProfile(p)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
