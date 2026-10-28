export default function AiDisclaimer() {
  return (
    <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Experimental AI screening result, not a diagnosis.</strong> Please confirm with a
      clinician. The model was trained only on Normal and AF recordings; other rhythms and noisy
      signals were left out, so its result can be wrong for them.
    </p>
  )
}
