import type { Timestamp } from 'firebase/firestore'

export type PredictionLabel = 'possible_af' | 'no_af_detected'
export type ReviewStatus = 'reviewed' | 'needs_followup' | 'inconclusive'

export interface Prediction {
  task: string
  label: PredictionLabel
  meanScore: number
  threshold: number
  windowScores: number[]
  modelId: string
  modelSha256: string | null
  preprocessVersion: string
}

export interface Recording {
  id: string
  synthetic?: boolean
  deviceId: string
  recordedAt: Timestamp
  uploadedAt: Timestamp
  samplingRateHz: number
  analysisRateHz: number
  windowSec: number
  windowCount: number
  durationSec: number
  storagePath: string
  format: string
  sizeBytes: number
  sha256: string
  prediction: Prediction
  quality: { flatSegment: boolean }
  processingStatus: string
}

export interface Review {
  id: string
  doctorUid: string
  status: ReviewStatus
  finding: string
  createdAt: Timestamp
}
