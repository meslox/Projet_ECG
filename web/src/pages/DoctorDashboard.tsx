import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAuthorisedPatients, type PatientLink } from '../data/doctor'

export default function DoctorDashboard({ doctorUid }: { doctorUid: string }) {
  const [patients, setPatients] = useState<PatientLink[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    listAuthorisedPatients(doctorUid)
      .then((p) => {
        if (!cancelled) setPatients(p)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your patient list.')
      })
    return () => {
      cancelled = true
    }
  }, [doctorUid])

  const needle = search.trim().toLowerCase()
  const shown = patients?.filter((p) => p.patientName.toLowerCase().includes(needle)) ?? []

  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-1 text-lg font-semibold">Your patients</h2>
      <p className="mb-3 text-sm text-slate-600">
        Only patients who have authorised you appear here. If a patient removes your access, they
        disappear from this list immediately.
      </p>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!error && patients === null && <p className="text-slate-600">Loading…</p>}
      {patients !== null && patients.length === 0 && (
        <p className="text-slate-600">No patients have authorised you yet.</p>
      )}

      {patients !== null && patients.length > 0 && (
        <>
          <input
            type="search"
            placeholder="Search patients by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
          {shown.length === 0 ? (
            <p className="text-sm text-slate-600">No patient matches that search.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {shown.map((p) => (
                <li key={p.patientUid} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <strong>{p.patientName}</strong>
                    {p.grantedAt && (
                      <span className="ml-2 text-xs text-slate-500">
                        authorised {p.grantedAt.toDate().toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  <Link to={`/patients/${p.patientUid}`} className="text-blue-600 underline">
                    View ECG history
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-slate-500">Names are shown as entered by the patient.</p>
    </section>
  )
}
