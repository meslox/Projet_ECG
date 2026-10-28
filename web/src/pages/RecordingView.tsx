import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AiDisclaimer from '../components/AiDisclaimer'
import ReviewSection from '../components/ReviewSection'
import { getRecording, loadEcgSamples } from '../data/recordings'
import { predictionText } from '../labels'
import type { Recording } from '../types'

const EcgChart = lazy(() => import('../components/EcgChart'))

interface Props {
  patientUid: string
  recordingId: string
  backTo: string
  viewerUid: string
  canReview: boolean
}

const when = (ts: { toDate(): Date }) => ts.toDate().toLocaleString()

export default function RecordingView({ patientUid, recordingId, backTo, viewerUid, canReview }: Props) {
  const [rec, setRec] = useState<Recording | null>(null)
  const [samples, setSamples] = useState<Float64Array | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await getRecording(patientUid, recordingId)
        if (cancelled) return
        if (!r) {
          setError('Recording not found.')
          return
        }
        setRec(r)
        loadEcgSamples(r.storagePath)
          .then((s) => {
            if (!cancelled) setSamples(s)
          })
          .catch(() => {
            if (!cancelled) setChartError('Could not load the ECG waveform file.')
          })
      } catch {
        if (!cancelled) setError('Could not load this recording.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patientUid, recordingId])

  return (
    <div className="space-y-4">
      <Link to={backTo} className="text-sm text-blue-600 underline">← Back</Link>
      {loading && <p className="text-slate-600">Loading…</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}

      {rec && (
        <>
          <AiDisclaimer />
          {rec.synthetic && (
            <p className="rounded bg-amber-100 p-2 text-sm text-amber-900">
              Synthetic demo data: not a real recording and not a real model output.
            </p>
          )}

          <section className="rounded-lg bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">ECG waveform</h2>
            {chartError && <p role="alert" className="text-red-600">{chartError}</p>}
            {!chartError && !samples && <p className="text-slate-600">Loading waveform…</p>}
            {samples && (
              <Suspense fallback={<p className="text-slate-600">Loading chart…</p>}>
                <EcgChart samples={samples} samplingRateHz={rec.samplingRateHz} />
              </Suspense>
            )}
            {rec.quality.flatSegment && (
              <p className="mt-2 text-sm text-red-700">
                A flat segment was detected in this recording. Check electrode contact.
              </p>
            )}
          </section>

          <section className="rounded-lg border-l-4 border-purple-400 bg-white p-4 shadow">
            <h2 className="mb-1 text-lg font-semibold">AI result (experimental)</h2>
            <p className="text-base">
              <strong>{predictionText(rec.prediction.label)}</strong>
              <span className="ml-2 text-sm text-slate-600">
                model score {rec.prediction.meanScore.toFixed(3)} · threshold {rec.prediction.threshold.toFixed(3)}
              </span>
            </p>
            <ul className="mt-2 text-sm text-slate-700">
              {rec.prediction.windowScores.map((s, i) => (
                <li key={i}>
                  {i * rec.windowSec}–{(i + 1) * rec.windowSec} s: {s.toFixed(3)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Model: {rec.prediction.modelId} · preprocessing: {rec.prediction.preprocessVersion}
              {rec.prediction.modelSha256 && <> · build {rec.prediction.modelSha256.slice(0, 12)}</>}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              The model score is the average of the window scores. It is not a calibrated probability.
            </p>
          </section>

          <ReviewSection
            patientUid={patientUid}
            recordingId={recordingId}
            viewerUid={viewerUid}
            canReview={canReview}
          />

          <section className="rounded-lg bg-white p-4 shadow">
            <h2 className="mb-2 text-lg font-semibold">Recording details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Recorded</dt><dd>{when(rec.recordedAt)}</dd>
              <dt className="text-slate-500">Uploaded</dt><dd>{when(rec.uploadedAt)}</dd>
              <dt className="text-slate-500">Device</dt><dd>{rec.deviceId}</dd>
              <dt className="text-slate-500">Sampling rate</dt><dd>{rec.samplingRateHz} Hz</dd>
              <dt className="text-slate-500">Length</dt><dd>{rec.durationSec} s ({rec.windowCount} windows of {rec.windowSec} s)</dd>
              <dt className="text-slate-500">File</dt><dd>{rec.format}, {(rec.sizeBytes / 1024).toFixed(1)} KB</dd>
              <dt className="text-slate-500">Checksum</dt><dd className="break-all">{rec.sha256.slice(0, 16)}…</dd>
              <dt className="text-slate-500">Processing</dt><dd>{rec.processingStatus}</dd>
            </dl>
          </section>
        </>
      )}
    </div>
  )
}
