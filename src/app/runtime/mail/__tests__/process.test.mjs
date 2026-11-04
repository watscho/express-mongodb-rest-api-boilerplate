import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import {
  replace,
  methods,
  reset,
  logger
} from '../../../../__tests__/helpers.mjs'
const database = methods(['connect', 'disconnect'])
const worker = { id: 'worker', stop: mock.fn(async () => {}) }
const stopObservation = mock.fn(),
  close = mock.fn(),
  report = mock.fn()
let failure, handlers, timeout
replace('app/config/delivery.js', {
  deliveryEnv: {
    MAIL_WORKER_SHUTDOWN_TIMEOUT_MS: 100,
    MAIL_WORKER_CONCURRENCY: 2
  }
})
replace('app/database/mongodb.js', { database })
replace('app/runtime/logger.js', { logger })
replace('app/runtime/diagnostics/mongodb.js', {
  observeMongoDB: () => stopObservation
})
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
replace('domains/notifications/index.js', {
  initializeMailTemplates: async () => {
    if (failure === 'templates') throw Error('templates')
  }
})
replace('domains/notifications/delivery/index.js', {
  startMailWorker: async () => {
    if (failure === 'worker') throw Error('worker')
    return worker
  },
  closeMailTransport: close
})
let once, exit, timer, clear
beforeEach(() => {
  failure = ''
  handlers = {}
  process.exitCode = 0
  reset(database, worker, logger, { stopObservation, close, report })
  database.connect.mock.mockImplementation(async () => {
    if (failure === 'database') throw Error('database')
  })
  database.disconnect.mock.mockImplementation(async () => {
    if (failure === 'disconnect') throw Error('disconnect')
  })
  worker.stop.mock.mockImplementation(async () => {
    if (failure === 'stop') throw Error('stop')
  })
  once = mock.method(process, 'once', (event, fn) => {
    handlers[event] = fn
    return process
  })
  exit = mock.method(process, 'exit', () => {})
  timer = mock.method(globalThis, 'setTimeout', fn => {
    timeout = fn
    return { unref() {} }
  })
  clear = mock.method(globalThis, 'clearTimeout', () => {})
})
afterEach(() => {
  for (const fn of [once, exit, timer, clear]) fn.mock.restore()
  process.exitCode = 0
})
let sequence = 0
const start = () =>
  import(`../../../../../dist/app/runtime/mail/process.js?case=${++sequence}`)
const settle = async () => {
  for (let i = 0; i < 8; i++) await setImmediate()
}
test('mail process starts and handles duplicate termination signals with one cleanup', async () => {
  await start()
  handlers.SIGINT()
  handlers.SIGTERM()
  await settle()
  assert.equal(worker.stop.mock.callCount(), 1)
  assert.equal(close.mock.callCount(), 1)
  assert.equal(database.disconnect.mock.callCount(), 1)
})
for (const mode of ['templates', 'database', 'worker'])
  test(`startup failure at ${mode} is cleaned up`, async () => {
    failure = mode
    await start()
    assert.equal(process.exitCode, 1)
    assert.equal(database.disconnect.mock.callCount(), 1)
    assert.equal(close.mock.callCount(), 1)
  })
for (const event of ['uncaughtException', 'unhandledRejection'])
  test(`fatal mail event ${event} drains`, async () => {
    await start()
    handlers[event](Error('fatal'))
    await settle()
    assert.equal(process.exitCode, 1)
    assert.equal(worker.stop.mock.callCount(), 1)
  })
for (const mode of ['stop', 'disconnect'])
  test(`mail shutdown ${mode} failure still closes transport and exits`, async () => {
    await start()
    failure = mode
    handlers.SIGTERM()
    await settle()
    assert.equal(close.mock.callCount(), 1)
    assert.equal(database.disconnect.mock.callCount(), 1)
    assert.equal(report.mock.calls[0].arguments[1].stage, 'shutdown')
    assert.equal(exit.mock.callCount(), 1)
  })
test('mail shutdown deadline exits with explicit failure', async () => {
  await start()
  handlers.SIGTERM()
  timeout()
  await settle()
  assert.deepEqual(exit.mock.calls[0].arguments, [1])
})
