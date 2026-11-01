import { model, Schema } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'
import {
  deliveryStatusSchema,
  deliveryPurposeSchema,
  deliveryErrorSchema,
  workerStatusSchema
} from './schemas.ts'

const emailOutboxSchema = new Schema(
  {
    _id: { type: String, required: true },
    template: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId },
    purpose: {
      type: String,
      enum: deliveryPurposeSchema.options,
      required: true
    },
    status: {
      type: String,
      enum: deliveryStatusSchema.options,
      required: true
    },
    // No recipients, plaintext tokens, variables, or rendered content in metadata.
    payload: { type: String, select: false, maxlength: 400000 },
    fingerprint: {
      type: String,
      required: true,
      select: false,
      match: /^[a-f\d]{64}$/
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger
    },
    maxAttempts: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      validate: Number.isSafeInteger
    },
    availableAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    leaseToken: { type: String },
    lockedUntil: { type: Date },
    lastErrorCode: { type: String, enum: deliveryErrorSchema.options },
    completedAt: { type: Date },
    purgeAt: { type: Date }
  },
  { timestamps: true, collection: 'email_outbox' }
)

emailOutboxSchema.index({ status: 1, availableAt: 1, _id: 1 })
emailOutboxSchema.index(
  { status: 1, lockedUntil: 1, _id: 1 },
  { name: 'outbox_expired_leases' }
)
emailOutboxSchema.index(
  { status: 1, createdAt: -1, _id: -1 },
  { name: 'outbox_status_created' }
)
emailOutboxSchema.index({ ownerId: 1, purpose: 1, status: 1 })
emailOutboxSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })

export type EmailOutboxDocument = HydratedDocument<
  InferSchemaType<typeof emailOutboxSchema>
>
export const EmailOutbox = model('EmailOutbox', emailOutboxSchema)

const emailWorkerSchema = new Schema(
  {
    _id: { type: String, required: true },
    status: {
      type: String,
      enum: workerStatusSchema.options,
      required: true
    },
    startedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    concurrency: { type: Number, required: true, min: 1, max: 20 },
    activeJobs: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true }
  },
  { collection: 'email_workers' }
)
emailWorkerSchema.index({ status: 1, lastSeenAt: -1 })
emailWorkerSchema.index({ lastSeenAt: -1 })
emailWorkerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
export const EmailWorker = model('EmailWorker', emailWorkerSchema)
