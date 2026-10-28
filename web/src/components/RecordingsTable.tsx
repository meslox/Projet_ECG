import { Link } from 'react-router-dom'
import { predictionText } from '../labels'
import type { Recording } from '../types'

interface Props {
  recordings: Recording[]
  linkFor: (recordingId: string) => string
}

export default function RecordingsTable({ recordings, linkFor }: Props) {
  return (
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
              <Link to={linkFor(r.id)} className="text-blue-600 underline">
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
  )
}
