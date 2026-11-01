import { randomUUID } from 'node:crypto'
import { mailEnv } from '../../../app/config/mail.ts'
import { setTimeout as delay } from 'node:timers/promises'
import { deliveryEnv as env } from '../../../app/config/delivery.ts'
import { logger } from '../../../app/runtime/logger.ts'
import { errorDiagnostic } from '../../../app/runtime/diagnostics/diagnostic.ts'
import type { DiagnosticDto } from '../../../app/runtime/diagnostics/dto.ts'
import { renderNotification } from '../renderer.ts'
import { sendMail, classifySmtpFailure } from '../mailer.ts'
import { deliveryRepository } from './repository.ts'
import { workerRepository } from './operations.ts'
import { decryptDelivery } from './utils.ts'
import type {
  ClaimedEmailDto,
  DeliveryErrorDto,
  SmtpFailureDto,
  WorkerStatusDto,
  TerminalDeliveryStatusDto
} from './dto.ts'
import type { RenderedNotificationDto } from '../dto.ts'

const failureDiagnostics: Record<
  DeliveryErrorDto,
  Pick<DiagnosticDto, 'reason' | 'hint'>
> = {
  'payload.invalid': {
    reason:
      'The encrypted email payload is missing, corrupt, or cannot be decrypted.',
    hint: 'Check API/worker encryption-key consistency and retained payloads before manual retry; never log decrypted content.'
  },
  'render.failed': {
    reason: 'Email preparation or rendering failed.',
    hint: 'Check the registered template, variable schema, locale dictionaries, file permissions, and compatible template assets on every worker.'
  },
  'smtp.temporary': {
    reason: 'SMTP reported a temporary failure.',
    hint: 'Inspect provider availability and queue age; bounded retries follow the existing retry policy.'
  },
  'smtp.permanent': {
    reason: 'SMTP reported a permanent rejection.',
    hint: 'Inspect sender/recipient policy and provider configuration through authorized tools before manual retry.'
  },
  'smtp.configuration': {
    reason: 'SMTP authentication, TLS, or configuration failed.',
    hint: 'Check worker SMTP settings, credential secrets, certificates, and sender configuration before manual retry.'
  },
  'smtp.connection': {
    reason: 'SMTP connection or submission failed.',
    hint: 'Check SMTP hostname, port, network, TLS mode, and provider availability; uncertain acceptance may mean the message was already submitted.'
  },
  'queue.attempts_exhausted': {
    reason: 'The delivery attempt budget is exhausted.',
    hint: 'Inspect previous failure categories and the expiry deadline before considering manual retry.'
  }
}

const retryDelay = (attempts: number): number => {
  const ceiling = Math.min(
    env.MAIL_RETRY_MAX_DELAY_MS,
    env.MAIL_RETRY_BASE_DELAY_MS * 2 ** Math.min(Math.max(attempts - 1, 0), 20)
  )
  // Equal jitter prevents replicas from retrying a failed provider in lockstep.
  return Math.round(ceiling / 2 + (Math.random() * ceiling) / 2)
}

const maintainLease = (job: ClaimedEmailDto) => {
  const controller = new AbortController()
  let lost = false
  const running = (async () => {
    while (!controller.signal.aborted) {
      try {
        await delay(Math.floor(env.MAIL_WORKER_LEASE_MS / 3), undefined, {
          signal: controller.signal
        })
        if (controller.signal.aborted) break
        if (
          !(await deliveryRepository.renew(job)) &&
          !controller.signal.aborted
        ) {
          lost = true
          break
        }
      } catch {
        if (!controller.signal.aborted) lost = true
        break
      }
    }
    if (lost)
      logger.warn('Email delivery lease lost', {
        component: 'mail-worker',
        code: 'EMAIL_LEASE_LOST',
        jobId: job.id,
        hint: 'Inspect cancellation, MongoDB availability, and competing claims; do not submit without a valid lease.'
      })
  })()
  return {
    isLost: () => lost,
    async stop() {
      controller.abort()
      await running
    }
  }
}

const finish = async (
  job: ClaimedEmailDto,
  status: TerminalDeliveryStatusDto,
  code?: DeliveryErrorDto
) => {
  if (await deliveryRepository.finish(job, status, code)) {
    logger.log(
      status === 'failed' ? 'error' : 'info',
      'Email delivery completed',
      {
        component: 'mail-worker',
        jobId: job.id,
        template: job.template,
        status,
        attempts: job.attempts,
        ...(code
          ? {
              code:
                status === 'expired'
                  ? 'EMAIL_DELIVERY_EXPIRED'
                  : 'EMAIL_DELIVERY_FAILED',
              errorCode: code,
              ...failureDiagnostics[code]
            }
          : {})
      }
    )
  }
}

const handleFailure = async (job: ClaimedEmailDto, failure: SmtpFailureDto) => {
  if (!failure.retryable || job.attempts >= job.maxAttempts) {
    await finish(job, 'failed', failure.code)
    return
  }
  const availableAt = new Date(Date.now() + retryDelay(job.attempts))
  if (availableAt >= job.expiresAt) {
    await finish(job, 'expired', failure.code)
    return
  }
  if (await deliveryRepository.retry(job, availableAt, failure.code)) {
    logger.warn('Email delivery retry scheduled', {
      component: 'mail-worker',
      code: 'EMAIL_RETRY_SCHEDULED',
      jobId: job.id,
      template: job.template,
      attempts: job.attempts,
      errorCode: failure.code,
      ...failureDiagnostics[failure.code],
      availableAt: availableAt.toISOString()
    })
  }
}

const processEmail = async (job: ClaimedEmailDto): Promise<void> => {
  const lease = maintainLease(job)
  try {
    if (job.expiresAt.getTime() <= Date.now()) {
      await finish(job, 'expired')
      return
    }
    // A crash on the final attempt must not leave a processing job stuck forever.
    if (job.attempts >= job.maxAttempts) {
      await finish(job, 'failed', 'queue.attempts_exhausted')
      return
    }
    const active = await deliveryRepository.startAttempt(job)
    if (!active) return
    job = active
    let input: unknown
    try {
      if (!job.payload) throw new Error('Missing email payload')
      input = decryptDelivery(job.id, job.payload)
    } catch {
      await finish(job, 'failed', 'payload.invalid')
      return
    }
    let rendered: RenderedNotificationDto
    try {
      rendered = await renderNotification(input)
    } catch {
      await finish(job, 'failed', 'render.failed')
      return
    }
    // Recheck cancellation and ownership immediately before contacting SMTP.
    if (lease.isLost() || !(await deliveryRepository.renew(job))) return
    if (job.expiresAt.getTime() <= Date.now()) {
      await finish(job, 'expired')
      return
    }
    let failure: SmtpFailureDto | undefined
    try {
      await sendMail({
        from: mailEnv.MAIL_FROM,
        to: rendered.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        messageId: `<${job.id}@${mailEnv.MAIL_MESSAGE_ID_DOMAIN}>`
      })
    } catch (error) {
      failure = classifySmtpFailure(error)
    }
    // Keep database acknowledgements outside the SMTP catch: a failed ack is
    // an uncertain delivery, recovered by lease expiry rather than immediate resend.
    if (failure) await handleFailure(job, failure)
    else await finish(job, 'sent')
  } finally {
    await lease.stop()
  }
}

export const startMailWorker = async () => {
  const controller = new AbortController()
  const heartbeatController = new AbortController()
  const id = randomUUID()
  const startedAt = new Date()
  let activeJobs = 0
  let status: WorkerStatusDto = 'running'
  const report = () =>
    workerRepository.report({
      id,
      startedAt,
      status,
      activeJobs,
      concurrency: env.MAIL_WORKER_CONCURRENCY
    })
  await report()
  const heartbeat = (async () => {
    while (!heartbeatController.signal.aborted) {
      try {
        await delay(env.MAIL_WORKER_HEARTBEAT_MS, undefined, {
          signal: heartbeatController.signal
        })
        if (!heartbeatController.signal.aborted) await report()
      } catch (error) {
        if (!heartbeatController.signal.aborted)
          logger.error('Worker heartbeat failed', {
            workerId: id,
            component: 'mail-worker',
            stage: 'heartbeat',
            ...errorDiagnostic(error, {
              component: 'mail-worker',
              stage: 'heartbeat'
            })
          })
      }
    }
  })()
  const consume = async () => {
    while (!controller.signal.aborted) {
      try {
        const job = await deliveryRepository.claim()
        if (job) {
          activeJobs += 1
          try {
            await processEmail(job)
          } finally {
            activeJobs -= 1
          }
          continue
        }
      } catch (error) {
        logger.error('Email worker iteration failed', {
          component: 'mail-worker',
          stage: 'consume',
          ...errorDiagnostic(error, {
            component: 'mail-worker',
            stage: 'consume'
          })
        })
      }
      try {
        await delay(env.MAIL_WORKER_POLL_MS, undefined, {
          signal: controller.signal
        })
      } catch {
        if (!controller.signal.aborted)
          throw new Error('Email worker poll failed')
      }
    }
  }
  const running = Promise.all(
    Array.from({ length: env.MAIL_WORKER_CONCURRENCY }, consume)
  )
  let stopPromise: Promise<void> | undefined
  return {
    id,
    stop(): Promise<void> {
      stopPromise ??= (async () => {
        status = 'draining'
        controller.abort()
        try {
          await report()
        } catch (error) {
          logger.warn('Cannot report worker draining', {
            workerId: id,
            component: 'mail-worker',
            stage: 'shutdown',
            ...errorDiagnostic(error, {
              component: 'mail-worker',
              stage: 'shutdown'
            })
          })
        }
        try {
          await running
        } finally {
          heartbeatController.abort()
          await heartbeat
          status = 'stopped'
          try {
            await report()
          } catch (error) {
            logger.warn('Cannot report worker stopped', {
              workerId: id,
              component: 'mail-worker',
              stage: 'shutdown',
              ...errorDiagnostic(error, {
                component: 'mail-worker',
                stage: 'shutdown'
              })
            })
          }
        }
      })()
      return stopPromise
    }
  }
}
