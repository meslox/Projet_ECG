import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  authorizeDoctor, findDoctorByCode, listGrantsWithDoctors, revokeGrant,
  type DoctorEntry, type GrantWithDoctor,
} from '../data/grants'

const CODE_RE = /^[A-Z0-9-]{3,20}$/

type Msg = { kind: 'error' | 'ok'; text: string }

export default function DoctorAccess() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const [grants, setGrants] = useState<GrantWithDoctor[] | null>(null)
  const [code, setCode] = useState('')
  const [candidate, setCandidate] = useState<DoctorEntry | null>(null)
  const [message, setMessage] = useState<Msg | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      setGrants(await listGrantsWithDoctors(uid))
    } catch {
      setMessage({ kind: 'error', text: 'Could not load your doctor list.' })
    }
  }, [uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onLookup(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setCandidate(null)
    const c = code.trim().toUpperCase()
    if (!CODE_RE.test(c)) {
      setMessage({ kind: 'error', text: 'Enter a valid doctor code (letters, numbers and dashes).' })
      return
    }
    setBusy(true)
    try {
      const d = await findDoctorByCode(c)
      if (d) setCandidate(d)
      else setMessage({ kind: 'error', text: 'No doctor found with that code.' })
    } catch {
      setMessage({ kind: 'error', text: 'Could not look up that code. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function grant(doctor: DoctorEntry) {
    if (!user || !profile) return
    setBusy(true)
    setMessage(null)
    try {
      const existing = grants?.find((g) => g.doctorUid === doctor.uid)
      if (existing?.status === 'active') {
        setMessage({ kind: 'ok', text: `${doctor.displayName} already has access.` })
      } else {
        await authorizeDoctor(user.uid, profile.displayName, doctor.uid, existing)
        setMessage({ kind: 'ok', text: `${doctor.displayName} now has access.` })
      }
      setCandidate(null)
      setCode('')
      await refresh()
    } catch {
      setMessage({ kind: 'error', text: 'Could not give access. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function revoke(g: GrantWithDoctor) {
    if (!window.confirm(`Remove ${g.doctorName}'s access to your ECG recordings?`)) return
    setBusy(true)
    setMessage(null)
    try {
      await revokeGrant(g.id)
      setMessage({ kind: 'ok', text: `${g.doctorName} no longer has access.` })
      await refresh()
    } catch {
      setMessage({ kind: 'error', text: 'Could not remove access. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-1 text-lg font-semibold">Doctors with access</h2>
      <p className="mb-3 text-sm text-slate-600">
        A doctor you authorise can see all your ECG recordings and add clinical reviews, until you
        remove their access. Removing access takes effect immediately; reviews already written stay.
      </p>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`mb-3 text-sm ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}
        >
          {message.text}
        </p>
      )}

      {grants === null && <p className="text-slate-600">Loading…</p>}
      {grants !== null && grants.length === 0 && (
        <p className="mb-3 text-sm text-slate-600">No doctor has access yet.</p>
      )}
      {grants !== null && grants.length > 0 && (
        <ul className="mb-4 divide-y divide-slate-200">
          {grants.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <strong>{g.doctorName}</strong>
                <span
                  className={`ml-2 rounded px-1 text-xs ${
                    g.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {g.status === 'active' ? 'has access' : 'access removed'}
                </span>
              </span>
              {g.status === 'active' ? (
                <button
                  disabled={busy}
                  onClick={() => void revoke(g)}
                  className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-60"
                >
                  Remove access
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => void grant({ uid: g.doctorUid, displayName: g.doctorName })}
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
                >
                  Authorise again
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onLookup} className="flex gap-2">
        <input
          type="text"
          placeholder="Doctor code, e.g. DR-DEMO1"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={20}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
        >
          Find doctor
        </button>
      </form>

      {candidate && (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <p>
            Give <strong>{candidate.displayName}</strong> access to all your ECG recordings?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy}
              onClick={() => void grant(candidate)}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-60"
            >
              Confirm
            </button>
            <button
              disabled={busy}
              onClick={() => setCandidate(null)}
              className="rounded border border-slate-300 px-3 py-1 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
