import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import {
  replace,
  methods,
  reset,
  logger
} from '../../../../__tests__/helpers.mjs'
const repo = methods(['claim', 'startAttempt', 'renew', 'finish', 'retry'])
const workers = methods(['report'])
const renderer = methods(['renderNotification'])
const mail = methods(['sendMail'])
replace('domains/notifications/delivery/repository.js', {
  deliveryRepository: repo
})
replace('domains/notifications/delivery/operations.js', {
  workerRepository: workers
})
replace('domains/notifications/renderer.js', renderer)
replace('domains/notifications/mailer.js', {
  ...mail,
  classifySmtpFailure: e => e.failure
})
replace('app/runtime/logger.js', { logger })
replace('app/config/delivery.js', {
  deliveryEnv: {
    MAIL_WORKER_CONCURRENCY: 1,
    MAIL_WORKER_POLL_MS: 5,
    MAIL_WORKER_HEARTBEAT_MS: 1000,
    MAIL_WORKER_LEASE_MS: 30000,
    MAIL_RETRY_BASE_DELAY_MS: 100,
    MAIL_RETRY_MAX_DELAY_MS: 1000
  }
})
const { encryptDelivery } =
  await import('../../../../../dist/domains/notifications/delivery/utils.js')
const { startMailWorker } =
  await import('../../../../../dist/domains/notifications/delivery/worker.js')
let job, claimed, completed
beforeEach(() => {
  reset(repo, workers, renderer, mail, logger)
  claimed = false
  completed = false
  job = {
    id: 'unit',
    template: 'signUp',
    attempts: 0,
    maxAttempts: 3,
    expiresAt: new Date(Date.now() + 10000),
    payload: encryptDelivery('unit', {
      email: 'unit@example.test',
      template: 'signUp',
      language: 'en',
      variables: {}
    })
  }
  repo.claim.mock.mockImplementation(async () => {
    if (claimed) return null
    claimed = true
    return job
  })
  repo.startAttempt.mock.mockImplementation(async j => ({
    ...j,
    attempts: j.attempts + 1
  }))
  repo.renew.mock.mockImplementation(async () => true)
  repo.finish.mock.mockImplementation(async () => {
    completed = true
    return true
  })
  repo.retry.mock.mockImplementation(async () => {
    completed = true
    return true
  })
  renderer.renderNotification.mock.mockImplementation(async () => ({
    email: 'unit@example.test',
    subject: 'subject',
    html: 'html',
    text: 'text'
  }))
  mail.sendMail.mock.mockImplementation(async () => ({
    accepted: ['unit@example.test']
  }))
})
async function run(until = () => completed) {
  const worker = await startMailWorker()
  try {
    for (let i = 0; i < 100 && !until(); i++) await setImmediate()
    assert(until(), 'worker did not reach expected state')
  } finally {
    const stop = worker.stop()
    assert.equal(worker.stop(), stop)
    await stop
  }
  assert.equal(workers.report.mock.calls.at(-1).arguments[0].status, 'stopped')
}
test('successful worker sends stable Message-ID and acknowledges sent', async () => {
  await run()
  assert.equal(repo.finish.mock.calls[0].arguments[1], 'sent')
  assert.equal(
    mail.sendMail.mock.calls[0].arguments[0].messageId,
    '<unit@notifications.local>'
  )
})
for (const [mode, status, code] of [
  ['expired', 'expired', undefined],
  ['exhausted', 'failed', 'queue.attempts_exhausted'],
  ['missing', 'failed', 'payload.invalid'],
  ['corrupt', 'failed', 'payload.invalid'],
  ['render', 'failed', 'render.failed']
])
  test(`worker handles ${mode} without SMTP`, async () => {
    if (mode === 'expired') job.expiresAt = new Date(0)
    if (mode === 'exhausted') job.attempts = 3
    if (mode === 'missing') delete job.payload
    if (mode === 'corrupt') job.payload = 'invalid'
    if (mode === 'render')
      renderer.renderNotification.mock.mockImplementation(async () => {
        throw Error('render')
      })
    await run()
    assert.equal(repo.finish.mock.calls[0].arguments[1], status)
    assert.equal(repo.finish.mock.calls[0].arguments[2], code)
    assert.equal(mail.sendMail.mock.callCount(), 0)
  })
for (const [mode, status] of [
  ['temporary', 'retry'],
  ['permanent', 'failed'],
  ['deadline', 'expired'],
  ['lastAttempt', 'failed']
])
  test(`SMTP ${mode} follows retry policy`, async () => {
    if (mode === 'deadline') job.expiresAt = new Date(Date.now() + 60000)
    if (mode === 'lastAttempt') job.attempts = 2
    mail.sendMail.mock.mockImplementation(async () => {
      if (mode === 'deadline') job.expiresAt.setTime(Date.now() + 1)
      throw {
        failure: {
          code: mode === 'permanent' ? 'smtp.permanent' : 'smtp.temporary',
          retryable: mode !== 'permanent'
        }
      }
    })
    const random = mock.method(Math, 'random', () => 0.5)
    try {
      await run()
      if (status === 'retry') {
        assert.equal(repo.retry.mock.callCount(), 1)
        const when = repo.retry.mock.calls[0].arguments[1]
        assert(when > Date.now() - 100)
      } else assert.equal(repo.finish.mock.calls[0].arguments[1], status)
    } finally {
      random.mock.restore()
    }
  })
test('lost lease prevents SMTP and acknowledgement', async () => {
  repo.renew.mock.mockImplementation(async () => false)
  await run(() => repo.renew.mock.callCount() > 0)
  assert.equal(mail.sendMail.mock.callCount(), 0)
  assert.equal(repo.finish.mock.callCount(), 0)
})
test('cancelled claim prevents processing', async () => {
  repo.startAttempt.mock.mockImplementation(async () => null)
  await run(() => repo.startAttempt.mock.callCount() > 0)
  assert.equal(mail.sendMail.mock.callCount(), 0)
})
test('acknowledgement failure is not immediately retried after SMTP acceptance', async () => {
  repo.finish.mock.mockImplementation(async () => {
    throw Error('database ack')
  })
  await run(() => logger.error.mock.callCount() > 0)
  assert.equal(mail.sendMail.mock.callCount(), 1)
  assert.equal(repo.retry.mock.callCount(), 0)
})
test('expiry after rendering prevents SMTP submission', async () => {
  renderer.renderNotification.mock.mockImplementation(async () => {
    job.expiresAt.setTime(0)
    return {
      email: 'unit@example.test',
      subject: 'Unit',
      html: 'Unit',
      text: 'Unit'
    }
  })
  await run()
  assert.equal(repo.finish.mock.calls[0].arguments[1], 'expired')
  assert.equal(mail.sendMail.mock.callCount(), 0)
})
test('lost finish and retry leases do not log successful acknowledgement', async () => {
  repo.finish.mock.mockImplementation(async () => {
    completed = true
    return false
  })
  await run()
  assert.equal(logger.log.mock.callCount(), 0)
  completed = false
  claimed = false
  repo.retry.mock.mockImplementation(async () => {
    completed = true
    return false
  })
  mail.sendMail.mock.mockImplementation(async () => {
    throw { failure: { code: 'smtp.temporary', retryable: true } }
  })
  await run()
  assert.equal(logger.warn.mock.callCount(), 0)
})
