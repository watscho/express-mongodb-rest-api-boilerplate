import { createHmac } from 'node:crypto'
import type { ClientSession } from 'mongoose'
import { queueEnv } from '../../../app/config/queue.ts'
import { AppError } from '../../../app/http/errors.ts'
import { emailSchema } from '../../users/schemas.ts'
import { EmailBudget } from './budget-model.ts'

// Both budget rows and the outbox write share the caller's transaction, including retries.
export const admitEmail = async (
  email: string,
  template: string,
  session: ClientSession
): Promise<void> => {
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const cooldown = ['resetPassword', 'verification'].includes(template)
    ? queueEnv.MAIL_SECURITY_COOLDOWN_MS
    : 0
  const recipient = emailSchema.parse(email)
  for (const [scope, limit, delay] of [
    ['recipient', queueEnv.MAIL_RECIPIENT_DAILY_LIMIT, 0],
    [`template:${template}`, queueEnv.MAIL_TEMPLATE_DAILY_LIMIT, cooldown]
  ] as const) {
    const id = createHmac(
      'sha256',
      Buffer.from(queueEnv.MAIL_QUEUE_ENCRYPTION_KEY, 'hex')
    )
      .update(`${scope}\0${recipient}`)
      .digest('hex')
    let budget
    try {
      budget = await EmailBudget.findOneAndUpdate(
        { _id: id },
        {
          $setOnInsert: {
            day,
            used: 0,
            nextAllowedAt: new Date(0),
            expiresAt: new Date(now.getTime() + 2 * 86400000)
          }
        },
        { session, upsert: true, returnDocument: 'after' }
      ).exec()
    } catch (error) {
      // A concurrent first insertion may abort this transaction; fail closed rather than enqueue.
      if (error instanceof Error && 'code' in error && error.code === 11000)
        throw new AppError(
          429,
          'notifications.recipient_rate_limited',
          undefined,
          1
        )
      throw error
    }
    if (!budget) throw new AppError(503, 'notifications.budget_unavailable')
    const used = budget.day === day ? budget.used : 0
    if (used >= limit || budget.nextAllowedAt > now)
      throw new AppError(
        429,
        'notifications.recipient_rate_limited',
        undefined,
        Math.max(
          1,
          Math.ceil(
            ((used >= limit
              ? Date.parse(`${day}T00:00:00Z`) + 86400000
              : budget.nextAllowedAt.getTime()) -
              now.getTime()) /
              1000
          )
        )
      )
    await EmailBudget.updateOne(
      { _id: id },
      {
        $set: {
          day,
          used: used + 1,
          nextAllowedAt: new Date(now.getTime() + delay),
          expiresAt: new Date(now.getTime() + 2 * 86400000)
        }
      },
      { session }
    ).exec()
  }
}
