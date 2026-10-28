import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/AuthContext'
import { renamePatient, sendResetEmail } from '../data/account'

type Msg = { kind: 'error' | 'ok'; text: string } | null

export default function AccountPage() {
  const { user, profile, reloadProfile } = useAuth()
  const [name, setName] = useState(profile?.displayName ?? '')
  const [nameMsg, setNameMsg] = useState<Msg>(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [resetMsg, setResetMsg] = useState<Msg>(null)
  const [resetBusy, setResetBusy] = useState(false)

  if (!user || !profile) return null

  async function onRename(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setNameMsg(null)
    const next = name.trim()
    if (next.length < 1 || next.length > 80) {
      setNameMsg({ kind: 'error', text: 'Enter a name of 1 to 80 characters.' })
      return
    }
    if (next === profile?.displayName) {
      setNameMsg({ kind: 'ok', text: 'That is already your name.' })
      return
    }
    setNameBusy(true)
    try {
      await renamePatient(user.uid, next)
      await reloadProfile()
      setNameMsg({ kind: 'ok', text: 'Name updated.' })
    } catch (err) {
      const denied = err instanceof FirebaseError && err.code === 'permission-denied'
      setNameMsg({
        kind: 'error',
        text: denied ? 'The change was blocked by the security rules.' : 'Could not update your name. Please try again.',
      })
    } finally {
      setNameBusy(false)
    }
  }

  async function onReset() {
    if (!user?.email) return
    setResetMsg(null)
    setResetBusy(true)
    try {
      await sendResetEmail(user.email)
      setResetMsg({ kind: 'ok', text: `A password reset email was sent to ${user.email}.` })
    } catch {
      setResetMsg({ kind: 'error', text: 'Could not send the email. Please try again later.' })
    } finally {
      setResetBusy(false)
    }
  }

  const msgClass = (m: Msg) => (m?.kind === 'error' ? 'text-red-600' : 'text-emerald-700')

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-blue-600 underline">← Back</Link>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-2 text-lg font-semibold">Your account</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Email</dt><dd>{user.email}</dd>
          <dt className="text-slate-500">Role</dt><dd>{profile.role}</dd>
          <dt className="text-slate-500">Name</dt><dd>{profile.displayName}</dd>
        </dl>
      </section>

      {profile.role === 'patient' ? (
        <section className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-1 text-lg font-semibold">Change your name</h2>
          <p className="mb-2 text-xs text-slate-500">
            Doctors who currently have access will see the new name. Doctors whose access you
            already removed will not.
          </p>
          <form onSubmit={onRename} className="flex gap-2">
            <input
              type="text" value={name} maxLength={80} autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit" disabled={nameBusy}
              className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {nameBusy ? 'Saving…' : 'Save'}
            </button>
          </form>
          {nameMsg && <p role={nameMsg.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${msgClass(nameMsg)}`}>{nameMsg.text}</p>}
        </section>
      ) : (
        <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
          Your name is managed by the administrator. Contact them if it needs to change.
        </p>
      )}

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-1 text-lg font-semibold">Password</h2>
        <p className="mb-2 text-xs text-slate-500">
          We will email you a link to choose a new password.
        </p>
        <button
          onClick={() => void onReset()} disabled={resetBusy}
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
        >
          {resetBusy ? 'Sending…' : 'Send password reset email'}
        </button>
        {resetMsg && <p role={resetMsg.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${msgClass(resetMsg)}`}>{resetMsg.text}</p>}
      </section>
    </div>
  )
}
