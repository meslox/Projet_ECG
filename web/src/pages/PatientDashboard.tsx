import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AiDisclaimer from '../components/AiDisclaimer'
import { listRecordings } from '../data/recordings'
import { predictionText } from '../labels'
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
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Recorded</th>
                <th>AI result (experimental)</th>
                <th>Model score</th>
                <th>Length</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((r) => (
                <tr key={r.id} className="border-t border-slate-200">
                  <td className="py-2">
                    <Link to={`/recordings/${r.id}`} className="text-blue-600 underline">
                      {r.recordedAt.toDate().toLocaleString()}
                    </Link>
                    {r.synthetic && (
                      <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-900">synthetic</span>
                    )}
                  </td>
                  <td>{predictionText(r.prediction.label)}</td>
                  <td>{r.prediction.meanScore.toFixed(3)}</td>
                  <td>{r.durationSec} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
