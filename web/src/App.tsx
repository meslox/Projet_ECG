import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import RecordingView from './pages/RecordingView'
import DoctorPatientView from './pages/DoctorPatientView'

// UX only: these redirects are not security controls. Access is enforced by Firestore/Storage rules.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-slate-600">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-3xl p-6">{children}</div>
}

function PatientRecordingRoute() {
  const { user, profile } = useAuth()
  const { id } = useParams()
  if (!user || !id || profile?.role !== 'patient') return <Navigate to="/" replace />
  return (
    <Page>
      <RecordingView patientUid={user.uid} recordingId={id} backTo="/" />
    </Page>
  )
}

function DoctorPatientRoute() {
  const { user, profile } = useAuth()
  const { pid } = useParams()
  if (!user || !pid || profile?.role !== 'doctor') return <Navigate to="/" replace />
  return (
    <Page>
      <DoctorPatientView doctorUid={user.uid} patientUid={pid} />
    </Page>
  )
}

function DoctorRecordingRoute() {
  const { user, profile } = useAuth()
  const { pid, id } = useParams()
  if (!user || !pid || !id || profile?.role !== 'doctor') return <Navigate to="/" replace />
  return (
    <Page>
      <RecordingView patientUid={pid} recordingId={id} backTo={`/patients/${pid}`} />
    </Page>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {import.meta.env.DEV && (
        <div className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
          Local emulator mode: demo data only
        </div>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/recordings/:id" element={<RequireAuth><PatientRecordingRoute /></RequireAuth>} />
        <Route path="/patients/:pid" element={<RequireAuth><DoctorPatientRoute /></RequireAuth>} />
        <Route
          path="/patients/:pid/recordings/:id"
          element={<RequireAuth><DoctorRecordingRoute /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
