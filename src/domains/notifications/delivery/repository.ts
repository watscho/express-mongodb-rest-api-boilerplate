import { randomUUID } from 'node:crypto'
import type { ClientSession } from 'mongoose'
import { deliveryEnv as env } from '../../../app/config/delivery.ts'
import { EmailOutbox } from './model.ts'
import { toClaimedEmailDto, toDeliveryDto } from './transformer.ts'
import type {
  ClaimedEmailDto,
  CreateDeliveryDto,
  DeliveryDto,
  DeliveryErrorDto,
  DeliveryPurposeDto,
  TerminalDeliveryStatusDto
} from './dto.ts'

const retentionDeadline = () =>
  new Date(Date.now() + env.MAIL_QUEUE_RETENTION_MS)
const ownedLease = (job: ClaimedEmailDto) => ({
  _id: job.id,
  status: 'processing' as const,
  leaseToken: job.leaseToken,
  lockedUntil: { $gt: new Date() }
})

export const deliveryRepository = {
  findEnqueued: (id: string, session: ClientSession) =>
    EmailOutbox.findById(id).session(session).select('+fingerprint').exec(),
  async enqueue({ id, ...record }: CreateDeliveryDto, session?: ClientSession) {
    try {
      return await EmailOutbox.findOneAndUpdate(
        { _id: id },
        {
          $setOnInsert: {
            ...record,
            status: 'queued',
            attempts: 0,
            availableAt: new Date(),
            purgeAt: new Date(
              record.expiresAt.getTime() + env.MAIL_QUEUE_RETENTION_MS
            )
          }
        },
        { upsert: true, returnDocument: 'after', session, runValidators: true }
      )
        .select('+fingerprint')
        .exec()
    } catch (error) {
      // A concurrent independent upsert may win the unique _id race. Inside a
      // transaction, propagate the error: MongoDB has aborted that transaction.
      if (
        session ||
        !(error instanceof Error && 'code' in error && error.code === 11000)
      )
        throw error
      return EmailOutbox.findById(id).select('+fingerprint').exec()
    }
  },

  async claim(): Promise<ClaimedEmailDto | null> {
    const now = new Date()
    const leaseToken = randomUUID()
    const update = {
      $set: {
        status: 'processing',
        leaseToken,
        lockedUntil: new Date(now.getTime() + env.MAIL_WORKER_LEASE_MS)
      }
    }
    // Each claim branch has its own matching sort/index; no cross-branch OR sort.
    const recovered = await EmailOutbox.findOneAndUpdate(
      {
        status: 'processing',
        lockedUntil: { $lte: now }
      },
      update,
      { sort: { lockedUntil: 1, _id: 1 }, returnDocument: 'after' }
    )
      .select('+payload')
      .exec()
    const job =
      recovered ??
      (await EmailOutbox.findOneAndUpdate(
        {
          status: 'queued',
          availableAt: { $lte: now }
        },
        update,
        { sort: { availableAt: 1, _id: 1 }, returnDocument: 'after' }
      )
        .select('+payload')
        .exec())
    return job ? toClaimedEmailDto(job, leaseToken) : null
  },

  async startAttempt(job: ClaimedEmailDto): Promise<ClaimedEmailDto | null> {
    const updated = await EmailOutbox.findOneAndUpdate(
      {
        ...ownedLease(job),
        attempts: { $lt: job.maxAttempts }
      },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after' }
    )
      .select('+payload')
      .exec()
    return updated ? toClaimedEmailDto(updated, job.leaseToken) : null
  },

  async renew(job: ClaimedEmailDto): Promise<boolean> {
    const result = await EmailOutbox.updateOne(ownedLease(job), {
      $set: { lockedUntil: new Date(Date.now() + env.MAIL_WORKER_LEASE_MS) }
    }).exec()
    return result.matchedCount === 1
  },

  async finish(
    job: ClaimedEmailDto,
    status: TerminalDeliveryStatusDto,
    lastErrorCode?: DeliveryErrorDto
  ): Promise<boolean> {
    const result = await EmailOutbox.updateOne(ownedLease(job), {
      $set: {
        status,
        completedAt: new Date(),
        purgeAt: retentionDeadline(),
        ...(lastErrorCode ? { lastErrorCode } : {})
      },
      $unset: {
        leaseToken: 1,
        lockedUntil: 1,
        ...(status === 'failed' ? {} : { payload: 1 }),
        ...(lastErrorCode ? {} : { lastErrorCode: 1 })
      }
    }).exec()
    return result.matchedCount === 1
  },

  async retry(
    job: ClaimedEmailDto,
    availableAt: Date,
    lastErrorCode: DeliveryErrorDto
  ): Promise<boolean> {
    const result = await EmailOutbox.updateOne(ownedLease(job), {
      $set: { status: 'queued', availableAt, lastErrorCode },
      $unset: { leaseToken: 1, lockedUntil: 1 }
    }).exec()
    return result.matchedCount === 1
  },

  async cancelPending(
    ownerId: string,
    session: ClientSession,
    purposes?: DeliveryPurposeDto[]
  ): Promise<void> {
    await EmailOutbox.updateMany(
      {
        ownerId,
        status: { $in: ['queued', 'processing', 'failed'] },
        ...(purposes ? { purpose: { $in: purposes } } : {})
      },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
          purgeAt: retentionDeadline()
        },
        $unset: { payload: 1, leaseToken: 1, lockedUntil: 1, lastErrorCode: 1 }
      },
      { session }
    ).exec()
  },

  async getDelivery(id: string): Promise<DeliveryDto | null> {
    const job = await EmailOutbox.findById(id)
      .select('-payload -fingerprint -ownerId')
      .maxTimeMS(10000)
      .exec()
    return job ? toDeliveryDto(job) : null
  },

  async retryFailed(id: string): Promise<DeliveryDto | null> {
    const job = await EmailOutbox.findOneAndUpdate(
      {
        _id: id,
        status: 'failed',
        expiresAt: { $gt: new Date() },
        payload: { $type: 'string' }
      },
      {
        $set: { status: 'queued', attempts: 0, availableAt: new Date() },
        $unset: { completedAt: 1, lastErrorCode: 1 }
      },
      { returnDocument: 'after' }
    )
      .select('-payload -fingerprint -ownerId')
      .maxTimeMS(10000)
      .exec()
    return job ? toDeliveryDto(job) : null
  }
}
