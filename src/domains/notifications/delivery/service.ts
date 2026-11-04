import { database } from '../../../app/database/mongodb.ts'
import { admitEmail } from './budget.ts'
import { deliveryEnv as env } from '../../../app/config/delivery.ts'
import { AppError } from '../../../app/http/errors.ts'
import { toValidationIssueDto } from '../../../app/http/transformer.ts'
import { prepareNotification } from '../preparation.ts'
import type { SendTemplateDto } from '../dto.ts'
import { enqueueOptionsSchema } from './schemas.ts'
import { deliveryRepository } from './repository.ts'
import { encryptDelivery, fingerprintDelivery } from './utils.ts'
import { createHash, randomUUID } from 'node:crypto'
import type { DeliveryReceiptDto, EnqueueContextDto } from './dto.ts'

export const enqueueTemplate = async (
  input: SendTemplateDto,
  { session, options = {} }: EnqueueContextDto = {}
): Promise<DeliveryReceiptDto> => {
  if (!session)
    return database.transaction(transaction =>
      enqueueTemplate(input, { session: transaction, options })
    )
  const notification = prepareNotification(input)
  const parsed = enqueueOptionsSchema.safeParse(options)
  if (!parsed.success) {
    throw new AppError(
      400,
      'notifications.invalid_queue_options',
      parsed.error.issues.map(toValidationIssueDto)
    )
  }
  const { idempotencyKey, ownerId, purpose, expiresAt } = parsed.data
  const deadline = new Date(
    Math.min(
      Date.now() + env.MAIL_QUEUE_MAX_AGE_MS,
      expiresAt?.getTime() ?? Infinity
    )
  )
  if (deadline.getTime() <= Date.now())
    throw new AppError(400, 'notifications.already_expired')
  const id =
    idempotencyKey === undefined
      ? randomUUID()
      : createHash('sha256').update(idempotencyKey).digest('hex')
  const fingerprint = fingerprintDelivery({
    notification,
    ownerId,
    purpose,
    expiresAt
  })
  if (idempotencyKey !== undefined) {
    const existing = await deliveryRepository.findEnqueued(id, session)
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new AppError(409, 'notifications.idempotency_conflict')
      return { id: existing._id, status: existing.status }
    }
  }
  await admitEmail(notification.email, notification.template, session)
  const job = await deliveryRepository.enqueue(
    {
      id,
      fingerprint,
      template: notification.template,
      payload: encryptDelivery(id, notification),
      ownerId,
      purpose,
      expiresAt: deadline,
      maxAttempts: env.MAIL_QUEUE_MAX_ATTEMPTS
    },
    session
  )
  if (!job) throw new AppError(500, 'notifications.enqueue_failed')
  if (job.fingerprint !== fingerprint)
    throw new AppError(409, 'notifications.idempotency_conflict')
  return { id: job._id, status: job.status }
}
