# Firestore schema (v1, design + emulator-tested rules)

Status: designed; rules tested only in the local emulator. Nothing deployed.

## Collections

| Path | Contents | Client writes |
|---|---|---|
| `users/{uid}` | `displayName`, `role` (patient/doctor), `createdAt` | Own doc, as patient only; role immutable. Doctors are created by an admin script. |
| `doctorDirectory/{doctorCode}` | `uid`, `displayName` | None (admin script) |
| `grants/{patientUid}_{doctorUid}` | `patientUid`, `doctorUid`, `status` (active/revoked), `patientName`, `grantedAt`, `revokedAt` | Patient only (create, revoke, re-grant) |
| `patients/{pid}/recordings/{rid}` | metadata + `prediction` (AI, experimental) | None (server only) |
| `patients/{pid}/recordings/{rid}/reviews/{id}` | `doctorUid`, `status`, `finding`, `createdAt` | Authorised doctor, create only |
| `patients/{pid}/recordings/{rid}/privateNotes/{id}` | `doctorUid`, `note`, `createdAt` | Authorised doctor, create only; only the author can read |
| `devices/{id}` | `ownerPatientUid`, `label`, `lastSeenAt` | None (planned) |
| `deviceSecrets/*`, `auditLogs/*` | server only | None, no client reads |

## Recording fields (from pi_af_inference.py outputs)

- Identity: `deviceId`, `recordedAt`, `uploadedAt`
- Signal: `samplingRateHz`, `analysisRateHz` (300), `windowSec` (10), `windowCount`, `durationSec`
- File: `storagePath`, `format`, `sizeBytes`, `sha256` (file lives in Cloud Storage, not Firestore)
- `prediction`: `task` ("normal_vs_af"), `label` ("possible_af" | "no_af_detected"), `meanScore`, `threshold`, `windowScores[]`, `modelId`, `modelSha256`, `preprocessVersion`
- `quality`: `flatSegment` (bool)
- `synthetic`: true for seeded demo data

## Rules of the model

- `prediction` is an experimental screening result, never a diagnosis. Clinician findings exist only in `reviews`.
- "Model score" is a mean of window outputs and is not a calibrated confidence.
- Model limitation (from the model card): Other and Noisy recordings were excluded from training.
- Access: a doctor reads a patient's data only while `grants/{pid}_{did}.status == "active"`.
- Known limit: security rules cannot log reads, so audit covers grants, uploads and reviews only.
