import { useEffect, useState } from 'react'
import AiDisclaimer from '../components/AiDisclaimer'
import DoctorAccess from '../components/DoctorAccess'
import RecordingsTable from '../components/RecordingsTable'
import { listRecordings } from '../data/recordings'
import type { Recording } from '../types'

export default function PatientDashboard({ patientUid }: { patientUid: string }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listRecordings(patientUid)
      .then((r) => {
        if (!cancelled) setRecordings(r)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your recordings.')
      })
    return () => {
      cancelled = true
    }
  }, [patientUid])

  return (
    <section className="space-y-4">
      <AiDisclaimer />
      <div className="rounded-lg bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-semibold">Your ECG recordings</h2>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!error && recordings === null && <p className="text-slate-600">Loading…</p>}
        {recordings !== null && recordings.length === 0 && (
          <p className="text-slate-600">
            No recordings yet. Recordings from your ECG device will appear here.
          </p>
        )}
        {recordings !== null && recordings.length > 0 && (
          <RecordingsTable recordings={recordings} linkFor={(id) => `/recordings/${id}`} />
        )}
      </div>
      <DoctorAccess />
    </section>
  )
}
