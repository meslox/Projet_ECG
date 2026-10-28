import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import RecordingView from './pages/RecordingView'

// UX only: these redirects are not security controls. Access is enforced by Firestore/Storage rules.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-slate-600">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PatientRecordingRoute() {
  const { user, profile } = useAuth()
  const { id } = useParams()
  if (!user || !id || profile?.role !== 'patient') return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-3xl p-6">
      <RecordingView patientUid={user.uid} recordingId={id} backTo="/" />
    </div>
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
        <Route
          path="/recordings/:id"
          element={<RequireAuth><PatientRecordingRoute /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
