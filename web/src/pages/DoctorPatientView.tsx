import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AiDisclaimer from '../components/AiDisclaimer'
import RecordingsTable from '../components/RecordingsTable'
import { getMyGrant } from '../data/doctor'
import { listRecordings } from '../data/recordings'
import type { Recording } from '../types'

interface Props {
  doctorUid: string
  patientUid: string
}

type State = 'loading' | 'denied' | 'revoked' | 'error' | 'ok'

export default function DoctorPatientView({ doctorUid, patientUid }: Props) {
  const [state, setState] = useState<State>('loading')
  const [patientName, setPatientName] = useState('')
  const [recordings, setRecordings] = useState<Recording[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let grant
      try {
        grant = await getMyGrant(patientUid, doctorUid)
      } catch {
        if (!cancelled) setState('denied')
        return
      }
      if (cancelled) return
      setPatientName(grant.patientName)
      if (grant.status !== 'active') {
        setState('revoked')
        return
      }
      try {
        const r = await listRecordings(patientUid)
        if (cancelled) return
        setRecordings(r)
        setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [doctorUid, patientUid])

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-blue-600 underline">← Your patients</Link>
      {state === 'loading' && <p className="text-slate-600">Loading…</p>}
      {state === 'denied' && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          You do not have access to this patient&apos;s records.
        </p>
      )}
      {state === 'revoked' && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          {patientName} has removed your access to their records.
        </p>
      )}
      {state === 'error' && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-700">
          Could not load this patient&apos;s recordings.
        </p>
      )}
      {state === 'ok' && (
        <>
          <AiDisclaimer />
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="mb-3 text-lg font-semibold">ECG history: {patientName}</h2>
            {recordings.length === 0 ? (
              <p className="text-slate-600">This patient has no recordings yet.</p>
            ) : (
              <RecordingsTable
                recordings={recordings}
                linkFor={(id) => `/patients/${patientUid}/recordings/${id}`}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
