import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import {
  replace,
  methods,
  reset,
  logger
} from '../../../../__tests__/helpers.mjs'
let timers = [],
  resolveOnAbort = false
const delay = (ms, _value, { signal }) =>
  new Promise((resolve, reject) => {
    const timer = {
      ms,
      signal,
      resolve: () => {
        signal.removeEventListener('abort', abort)
        resolve()
      },
      reject: error => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    }
    const abort = () => (resolveOnAbort ? resolve() : reject(Error('aborted')))
    if (signal.aborted) abort()
    else {
      timers.push(timer)
      signal.addEventListener('abort', abort, { once: true })
    }
  })
mock.module('node:timers/promises', {
  exports: { setTimeout: delay, setImmediate }
})
const repo = methods(['claim', 'startAttempt', 'renew', 'finish', 'retry']),
  workers = methods(['report']),
  renderer = methods(['renderNotification']),
  mail = methods(['sendMail'])
replace('domains/notifications/delivery/repository.js', {
  deliveryRepository: repo
})
replace('domains/notifications/delivery/operations.js', {
  workerRepository: workers
})
replace('domains/notifications/renderer.js', renderer)
replace('domains/notifications/mailer.js', {
  ...mail,
  classifySmtpFailure: () => ({ code: 'smtp.temporary', retryable: true })
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
let job, claimed, rendered, releaseRender
beforeEach(() => {
  reset(repo, workers, renderer, mail, logger)
  timers = []
  resolveOnAbort = false
  claimed = false
  rendered = false
  job = {
    id: 'unit',
    template: 'signUp',
    attempts: 0,
    maxAttempts: 3,
    expiresAt: new Date(Date.now() + 60000),
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
  repo.startAttempt.mock.mockImplementation(async j => ({ ...j, attempts: 1 }))
  repo.renew.mock.mockImplementation(async () => true)
  repo.finish.mock.mockImplementation(async () => true)
  renderer.renderNotification.mock.mockImplementation(
    () =>
      new Promise(resolve => {
        rendered = true
        releaseRender = () =>
          resolve({
            email: 'unit@example.test',
            subject: 'Unit',
            html: 'Unit',
            text: 'Unit'
          })
      })
  )
})
const settle = async () => {
  for (let i = 0; i < 8; i++) await setImmediate()
}
const fire = ms => {
  const index = timers.findIndex(
    timer => timer.ms === ms && !timer.signal.aborted
  )
  assert(index >= 0, 'missing timer ' + ms)
  const [timer] = timers.splice(index, 1)
  timer.resolve()
  return timer
}
for (const outcome of ['lost', 'error', 'renewed'])
  test(`maintenance lease timer ${outcome} while rendering`, async () => {
    const worker = await startMailWorker()
    await settle()
    assert(rendered)
    repo.renew.mock.mockImplementation(async () => {
      if (outcome === 'error') throw Error('database')
      return outcome === 'renewed'
    })
    fire(10000)
    await settle()
    assert.equal(repo.renew.mock.callCount(), 1)
    if (outcome === 'renewed') {
      repo.renew.mock.mockImplementation(async () => true)
    }
    releaseRender()
    await settle()
    await worker.stop()
    if (outcome !== 'renewed') {
      assert.equal(mail.sendMail.mock.callCount(), 0)
      assert(
        logger.warn.mock.calls.some(
          call => call.arguments[1].code === 'EMAIL_LEASE_LOST'
        )
      )
    } else assert.equal(mail.sendMail.mock.callCount(), 1)
  })
test('heartbeat reports progress, logs failure and stops cleanly', async () => {
  repo.claim.mock.mockImplementation(async () => null)
  const worker = await startMailWorker()
  await settle()
  fire(1000)
  await settle()
  assert.equal(workers.report.mock.callCount(), 2)
  workers.report.mock.mockImplementationOnce(async () => {
    throw Error('heartbeat')
  })
  fire(1000)
  await settle()
  assert(
    logger.error.mock.calls.some(
      call => call.arguments[0] === 'Worker heartbeat failed'
    )
  )
  await worker.stop()
})
test('timer resolution racing with abort skips lease renewal and late heartbeat', async () => {
  resolveOnAbort = true
  const worker = await startMailWorker()
  await settle()
  releaseRender()
  await settle()
  await worker.stop()
  assert.equal(repo.renew.mock.callCount(), 1)
  assert.equal(workers.report.mock.callCount(), 3)
})
test('shutdown heartbeat failures are logged while consumers drain', async () => {
  repo.claim.mock.mockImplementation(async () => null)
  const worker = await startMailWorker()
  workers.report.mock.mockImplementation(async () => {
    throw Error('report')
  })
  await worker.stop()
  assert.equal(logger.warn.mock.callCount(), 2)
})
test('unexpected poll timer rejection propagates through stop', async () => {
  repo.claim.mock.mockImplementation(async () => null)
  const worker = await startMailWorker()
  await settle()
  const timer = timers.find(value => value.ms === 5)
  timer.reject(Error('poll'))
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await assert.rejects(() => worker.stop(), /Email worker poll failed/)
})
test('initial heartbeat failure prevents starting consumers', async () => {
  workers.report.mock.mockImplementation(async () => {
    throw Error('initial')
  })
  await assert.rejects(() => startMailWorker(), /initial/)
  assert.equal(repo.claim.mock.callCount(), 0)
})
