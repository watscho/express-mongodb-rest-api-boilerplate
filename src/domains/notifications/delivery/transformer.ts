import type { EmailOutboxDocument } from './model.ts'
import type { ClaimedEmailDto, DeliveryDto } from './dto.ts'
export const toDeliveryDto = (job: EmailOutboxDocument): DeliveryDto => ({
  id: job._id,
  status: job.status,
  template: job.template,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  availableAt: job.availableAt.toISOString(),
  expiresAt: job.expiresAt.toISOString(),
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
  ...(job.completedAt ? { completedAt: job.completedAt.toISOString() } : {}),
  ...(job.lastErrorCode ? { lastErrorCode: job.lastErrorCode } : {})
})
export const toClaimedEmailDto = (
  job: EmailOutboxDocument,
  leaseToken: string
): ClaimedEmailDto => ({
  id: job._id,
  template: job.template,
  payload: job.payload ?? undefined,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  expiresAt: job.expiresAt,
  leaseToken
})
