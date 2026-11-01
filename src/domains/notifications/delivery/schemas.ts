import { z } from 'zod'
import { objectIdSchema } from '../../users/schemas.ts'

export const deliveryStatusSchema = z.enum([
  'queued',
  'processing',
  'sent',
  'failed',
  'cancelled',
  'expired'
])
export const deliveryPurposeSchema = z.enum([
  'custom',
  'account',
  'resetPassword',
  'verification'
])
export const deliveryErrorSchema = z.enum([
  'payload.invalid',
  'render.failed',
  'smtp.temporary',
  'smtp.permanent',
  'smtp.configuration',
  'smtp.connection',
  'queue.attempts_exhausted'
])
export const enqueueOptionsSchema = z
  .object({
    idempotencyKey: z.string().min(1).max(200).optional(),
    ownerId: objectIdSchema.optional(),
    purpose: deliveryPurposeSchema.default('custom'),
    expiresAt: z.date().optional()
  })
  .superRefine((value, ctx) => {
    if (value.purpose !== 'custom' && !value.ownerId) {
      ctx.addIssue({
        code: 'custom',
        path: ['ownerId'],
        message: 'notifications.owner_required'
      })
    }
  })
export const deliveryReceiptSchema = z.object({
  id: z.string(),
  status: deliveryStatusSchema
})
export const deliverySchema = deliveryReceiptSchema.extend({
  template: z.string(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  availableAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
  lastErrorCode: deliveryErrorSchema.optional()
})
export const claimedEmailSchema = deliverySchema
  .pick({ id: true, template: true, attempts: true, maxAttempts: true })
  .extend({
    payload: z.string().optional(),
    leaseToken: z.uuid(),
    expiresAt: z.date()
  })
export const smtpFailureSchema = z.object({
  code: deliveryErrorSchema.extract([
    'smtp.temporary',
    'smtp.permanent',
    'smtp.configuration',
    'smtp.connection'
  ]),
  retryable: z.boolean()
})
export const createDeliverySchema = deliverySchema
  .pick({ id: true, template: true, maxAttempts: true })
  .extend({
    payload: z.string(),
    fingerprint: z.string(),
    ownerId: z.string().optional(),
    purpose: deliveryPurposeSchema,
    expiresAt: z.date()
  })
export const terminalDeliveryStatusSchema = deliveryStatusSchema.extract([
  'sent',
  'failed',
  'expired'
])

const deliveryIdSchema = z.union([z.uuid(), z.string().regex(/^[a-f\d]{64}$/)])
export const deliveryCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: deliveryIdSchema
})
const listLimitSchema = z.coerce.number().int().min(1).max(100)
export const deliveryListOptionsSchema = z.object({
  status: deliveryStatusSchema.default('failed'),
  limit: listLimitSchema.default(25),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(512)
    .optional()
})
export const deliveryListSchema = z.object({
  items: z.array(deliverySchema),
  nextCursor: z.string().optional()
})
export const workerStatusSchema = z.enum(['running', 'draining', 'stopped'])
export const workerHeartbeatSchema = z.object({
  id: z.uuid(),
  status: workerStatusSchema,
  startedAt: z.date(),
  concurrency: z.number().int().min(1).max(20),
  activeJobs: z.number().int().nonnegative()
})
export const workerSnapshotSchema = workerHeartbeatSchema.extend({
  startedAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  stale: z.boolean()
})
export const deliveryStatsSchema = z.object({
  generatedAt: z.iso.datetime(),
  counts: z.record(deliveryStatusSchema, z.number().int().nonnegative()),
  dueQueued: z.number().int().nonnegative(),
  expiredLeases: z.number().int().nonnegative(),
  oldestQueuedAgeMs: z.number().nonnegative().nullable(),
  activeWorkers: z.number().int().nonnegative()
})
export const queueCommandSchema = z.discriminatedUnion('command', [
  z.strictObject({ command: z.literal('stats') }),
  z.strictObject({ command: z.literal('workers') }),
  z.strictObject({ command: z.literal('health') }),
  z.strictObject({ command: z.literal('show'), id: deliveryIdSchema }),
  z.strictObject({ command: z.literal('retry'), id: deliveryIdSchema }),
  z.strictObject({
    command: z.literal('list'),
    status: deliveryStatusSchema.optional(),
    limit: listLimitSchema.optional(),
    cursor: z.string().max(512).optional()
  })
])
