import { deliveryEnv } from '../../../app/config/delivery.ts'
import { AppError } from '../../../app/http/errors.ts'
import { EmailOutbox, EmailWorker } from './model.ts'
import { deliveryRepository } from './repository.ts'
import {
  deliveryCursorSchema,
  deliveryListOptionsSchema,
  deliveryStatusSchema
} from './schemas.ts'
import { toDeliveryDto } from './transformer.ts'
import type {
  DeliveryCursorDto,
  DeliveryListOptionsDto,
  DeliveryListDto,
  DeliveryStatsDto,
  WorkerHeartbeatDto,
  WorkerSnapshotDto
} from './dto.ts'

const maxTimeMS = 10000
const freshSince = () => new Date(Date.now() - deliveryEnv.MAIL_WORKER_STALE_MS)

export const workerRepository = {
  report: ({ id, ...state }: WorkerHeartbeatDto) => {
    const now = new Date()
    return EmailWorker.updateOne(
      { _id: id },
      {
        $set: {
          ...state,
          lastSeenAt: now,
          expiresAt: new Date(
            now.getTime() + deliveryEnv.MAIL_WORKER_STALE_MS * 10
          )
        }
      },
      { upsert: true, runValidators: true }
    ).exec()
  },
  async list(): Promise<WorkerSnapshotDto[]> {
    const workers = await EmailWorker.find()
      .sort({ lastSeenAt: -1 })
      .limit(100)
      .maxTimeMS(maxTimeMS)
      .lean()
      .exec()
    const cutoff = freshSince().getTime()
    return workers.map(worker => ({
      id: worker._id,
      status: worker.status,
      startedAt: worker.startedAt.toISOString(),
      lastSeenAt: worker.lastSeenAt.toISOString(),
      concurrency: worker.concurrency,
      activeJobs: worker.activeJobs,
      stale: worker.lastSeenAt.getTime() < cutoff
    }))
  },
  async healthy(): Promise<boolean> {
    return Boolean(
      await EmailWorker.exists({
        status: 'running',
        lastSeenAt: { $gte: freshSince() }
      })
        .maxTimeMS(maxTimeMS)
        .exec()
    )
  }
}

export const deliveryOperations = {
  show: deliveryRepository.getDelivery,
  retry: deliveryRepository.retryFailed,
  workers: workerRepository.list,
  healthy: workerRepository.healthy,
  async list(options: DeliveryListOptionsDto = {}): Promise<DeliveryListDto> {
    const parsed = deliveryListOptionsSchema.safeParse(options)
    if (!parsed.success)
      throw new AppError(400, 'notifications.invalid_list_options')
    const { status, limit, cursor } = parsed.data
    let position: DeliveryCursorDto | undefined
    if (cursor) {
      try {
        const value = deliveryCursorSchema.safeParse(
          JSON.parse(
            Buffer.from(cursor, 'base64url').toString('utf8')
          ) as unknown
        )
        if (!value.success) throw new Error('Invalid cursor')
        position = value.data
      } catch {
        throw new AppError(400, 'notifications.invalid_cursor')
      }
    }
    const rows = await EmailOutbox.find({
      status,
      ...(position
        ? {
            $or: [
              { createdAt: { $lt: new Date(position.createdAt) } },
              {
                createdAt: new Date(position.createdAt),
                _id: { $lt: position.id }
              }
            ]
          }
        : {})
    })
      .select('-payload -fingerprint -ownerId')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .maxTimeMS(maxTimeMS)
      .exec()
    const items = rows.slice(0, limit)
    const last = items.at(-1)
    return {
      items: items.map(toDeliveryDto),
      ...(rows.length > limit && last
        ? {
            nextCursor: Buffer.from(
              JSON.stringify({
                createdAt: last.createdAt.toISOString(),
                id: last._id
              })
            ).toString('base64url')
          }
        : {})
    }
  },
  async stats(): Promise<DeliveryStatsDto> {
    const now = new Date()
    const [counts, dueQueued, expiredLeases, oldest, activeWorkers] =
      await Promise.all([
        Promise.all(
          deliveryStatusSchema.options.map(
            async status =>
              [
                status,
                await EmailOutbox.countDocuments({ status })
                  .maxTimeMS(maxTimeMS)
                  .exec()
              ] as const
          )
        ),
        EmailOutbox.countDocuments({
          status: 'queued',
          availableAt: { $lte: now }
        })
          .maxTimeMS(maxTimeMS)
          .exec(),
        EmailOutbox.countDocuments({
          status: 'processing',
          lockedUntil: { $lte: now }
        })
          .maxTimeMS(maxTimeMS)
          .exec(),
        EmailOutbox.findOne({ status: 'queued' })
          .select('createdAt')
          .sort({ createdAt: 1, _id: 1 })
          .maxTimeMS(maxTimeMS)
          .lean()
          .exec(),
        EmailWorker.countDocuments({
          status: 'running',
          lastSeenAt: { $gte: freshSince() }
        })
          .maxTimeMS(maxTimeMS)
          .exec()
      ])
    return {
      generatedAt: now.toISOString(),
      counts: Object.fromEntries(counts) as DeliveryStatsDto['counts'],
      dueQueued,
      expiredLeases,
      oldestQueuedAgeMs: oldest
        ? Math.max(0, now.getTime() - oldest.createdAt.getTime())
        : null,
      activeWorkers
    }
  }
}
