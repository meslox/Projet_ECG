import { useAuth } from '../auth/AuthContext'
import DoctorDashboard from './DoctorDashboard'
import PatientDashboard from './PatientDashboard'

export default function Home() {
  const { user, profile, logout } = useAuth()

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">ECG Monitor</h1>
          {profile && (
            <p className="text-sm text-slate-600">
              {profile.displayName} · <span className="font-medium">{profile.role}</span>
            </p>
          )}
        </div>
        <button onClick={() => void logout()} className="rounded border border-slate-300 px-3 py-1 text-sm">
          Sign out
        </button>
      </header>

      {!profile || !user ? (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          Your account ({user?.email}) has no profile record, so no dashboard can be shown.
          Please sign out and contact the administrator.
        </p>
      ) : profile.role === 'patient' ? (
        <PatientDashboard patientUid={user.uid} />
      ) : (
        <DoctorDashboard doctorUid={user.uid} />
      )}
    </div>
  )
}
