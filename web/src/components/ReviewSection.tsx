import { useEffect, useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import { listReviews } from '../data/recordings'
import { addPrivateNote, addReview, listMyPrivateNotes, type PrivateNote } from '../data/reviews'
import { reviewStatusText } from '../labels'
import type { Review, ReviewStatus } from '../types'

interface Props {
  patientUid: string
  recordingId: string
  viewerUid: string
  canReview: boolean
}

const STATUSES: ReviewStatus[] = ['reviewed', 'needs_followup', 'inconclusive']
const when = (ts: { toDate(): Date }) => ts.toDate().toLocaleString()

function saveError(e: unknown): string {
  if (e instanceof FirebaseError && e.code === 'permission-denied') {
    return 'Not saved: you do not have access to this patient any more.'
  }
  return 'Could not save. Please try again.'
}

export default function ReviewSection({ patientUid, recordingId, viewerUid, canReview }: Props) {
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [notes, setNotes] = useState<PrivateNote[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [status, setStatus] = useState<ReviewStatus>('reviewed')
  const [finding, setFinding] = useState('')
  const [reviewMsg, setReviewMsg] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)

  const [note, setNote] = useState('')
  const [noteMsg, setNoteMsg] = useState<string | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    listReviews(patientUid, recordingId)
      .then((v) => {
        if (!cancelled) setReviews(v)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load clinician reviews.')
      })
    if (canReview) {
      listMyPrivateNotes(patientUid, recordingId, viewerUid)
        .then((n) => {
          if (!cancelled) setNotes(n)
        })
        .catch(() => {
          if (!cancelled) setLoadError('Could not load your private notes.')
        })
    }
    return () => {
      cancelled = true
    }
  }, [patientUid, recordingId, viewerUid, canReview, reloadKey])

  async function submitReview(e: FormEvent) {
    e.preventDefault()
    setReviewMsg(null)
    const text = finding.trim()
    if (text.length < 1 || text.length > 500) {
      setReviewMsg('Write a finding of 1 to 500 characters.')
      return
    }
    setReviewBusy(true)
    try {
      await addReview(patientUid, recordingId, viewerUid, status, text)
      setFinding('')
      setReviewMsg('Review saved.')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setReviewMsg(saveError(err))
    } finally {
      setReviewBusy(false)
    }
  }

  async function submitNote(e: FormEvent) {
    e.preventDefault()
    setNoteMsg(null)
    const text = note.trim()
    if (text.length < 1 || text.length > 2000) {
      setNoteMsg('Write a note of 1 to 2000 characters.')
      return
    }
    setNoteBusy(true)
    try {
      await addPrivateNote(patientUid, recordingId, viewerUid, text)
      setNote('')
      setNoteMsg('Private note saved.')
      setReloadKey((k) => k + 1)
    } catch (err) {
      setNoteMsg(saveError(err))
    } finally {
      setNoteBusy(false)
    }
  }

  const author = (uid: string) =>
    uid === viewerUid ? 'You' : canReview ? 'Another clinician' : 'Clinician'

  return (
    <>
      <section className="rounded-lg border-l-4 border-emerald-500 bg-white p-4 shadow">
        <h2 className="mb-1 text-lg font-semibold">Clinician review</h2>
        <p className="mb-2 text-xs text-slate-500">
          Written by a clinician. This is separate from the experimental AI result above.
        </p>
        {loadError && <p role="alert" className="text-red-600">{loadError}</p>}
        {!loadError && reviews === null && <p className="text-sm text-slate-600">Loading…</p>}
        {reviews !== null && reviews.length === 0 && (
          <p className="text-sm text-slate-600">Not reviewed by a clinician yet.</p>
        )}
        {reviews?.map((v) => (
          <div key={v.id} className="mb-2 border-t border-slate-200 pt-2 text-sm">
            <p>
              <strong>{reviewStatusText(v.status)}</strong> · {author(v.doctorUid)} · {when(v.createdAt)}
            </p>
            <p className="text-slate-700">{v.finding}</p>
          </div>
        ))}

        {canReview && (
          <form onSubmit={submitReview} className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold">Add a review (the patient can see this)</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReviewStatus)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{reviewStatusText(s)}</option>
              ))}
            </select>
            <textarea
              value={finding}
              onChange={(e) => setFinding(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Finding (up to 500 characters)"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500">
              Saved reviews cannot be edited or deleted. To correct one, add a new review.
            </p>
            {reviewMsg && <p role="status" className="text-sm text-slate-700">{reviewMsg}</p>}
            <button
              type="submit"
              disabled={reviewBusy}
              className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-60"
            >
              {reviewBusy ? 'Saving…' : 'Save review'}
            </button>
          </form>
        )}
      </section>

      {canReview && (
        <section className="rounded-lg border-l-4 border-slate-400 bg-white p-4 shadow">
          <h2 className="mb-1 text-lg font-semibold">Your private notes</h2>
          <p className="mb-2 text-xs text-slate-500">
            Only you can see these notes. The patient and other doctors cannot.
          </p>
          {notes !== null && notes.length === 0 && (
            <p className="text-sm text-slate-600">No private notes yet.</p>
          )}
          {notes?.map((n) => (
            <div key={n.id} className="mb-2 border-t border-slate-200 pt-2 text-sm">
              <p className="text-xs text-slate-500">{when(n.createdAt)}</p>
              <p className="whitespace-pre-wrap text-slate-700">{n.note}</p>
            </div>
          ))}
          <form onSubmit={submitNote} className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Private note (up to 2000 characters)"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            {noteMsg && <p role="status" className="text-sm text-slate-700">{noteMsg}</p>}
            <button
              type="submit"
              disabled={noteBusy}
              className="rounded bg-slate-700 px-3 py-1 text-sm text-white disabled:opacity-60"
            >
              {noteBusy ? 'Saving…' : 'Save private note'}
            </button>
          </form>
        </section>
      )}
    </>
  )
}
