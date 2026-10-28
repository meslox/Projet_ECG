import { useAuth } from '../auth/AuthContext'

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

      {!profile ? (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          Your account ({user?.email}) has no profile record, so no dashboard can be shown.
          Please sign out and contact the administrator.
        </p>
      ) : (
        <section className="rounded-lg bg-white p-6 shadow">
          <p>
            Signed in as a <strong>{profile.role}</strong>.
            {profile.role === 'patient'
              ? ' Your ECG recordings will appear here.'
              : ' Patients who authorise you will appear here.'}
          </p>
          <p className="mt-2 text-sm text-slate-500">Dashboard coming in the next step.</p>
        </section>
      )}
    </div>
  )
}
