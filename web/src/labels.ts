import type { PredictionLabel, ReviewStatus } from './types'

export function predictionText(label: PredictionLabel): string {
  return label === 'possible_af' ? 'Possible AF' : 'No AF detected'
}

export function reviewStatusText(status: ReviewStatus): string {
  switch (status) {
    case 'reviewed':
      return 'Reviewed'
    case 'needs_followup':
      return 'Needs follow-up'
    case 'inconclusive':
      return 'Inconclusive'
  }
}
