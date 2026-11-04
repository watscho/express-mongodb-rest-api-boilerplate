import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { setImmediate } from 'node:timers/promises'
import { replace, methods, reset, logger } from '../../../__tests__/helpers.mjs'
const db = methods(['connect', 'disconnect']),
  redis = { ...methods(['connect', 'close', 'destroy']), isOpen: false }
const report = mock.fn(),
  stop = mock.fn()
let mode, server, handlers, timeout
const env = {
  APP_PORT: 8000,
  APP_HOST: '127.0.0.1',
  NODE_ENV: 'development',
  SHUTDOWN_TIMEOUT_MS: 100
}
mock.module('node:fs/promises', {
  exports: {
    mkdir: async () => {
      if (mode === 'storage') throw Error('storage')
    }
  }
})
mock.module('node:http', {
  exports: {
    createServer: () => {
      server = new EventEmitter()
      server.listening = false
      server.listen = (_port, _host, cb) => {
        if (mode === 'listen') server.emit('error', Error('listen'))
        else {
          server.listening = true
          cb()
        }
      }
      server.close = mock.fn(cb => {
        server.listening = false
        cb(mode === 'close' ? Error('close') : undefined)
      })
      server.closeAllConnections = mock.fn()
      return server
    }
  }
})
replace('app/config/api.js', { apiEnv: env })
replace('app/http/app.js', { createApp: () => () => {} })
replace('app/database/mongodb.js', { database: db })
replace('app/database/redis.js', { redis })
replace('app/runtime/logger.js', { logger })
replace('app/runtime/diagnostics/mongodb.js', { observeMongoDB: () => stop })
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
replace('domains/media/index.js', { storageRoot: '/unit' })
let once, exit, timer, clear
beforeEach(() => {
  mode = ''
  handlers = {}
  reset(db, redis, logger, { report, stop })
  redis.isOpen = false
  process.exitCode = 0
  db.connect.mock.mockImplementation(async () => {
    if (mode === 'mongodb') throw Error('database')
  })
  db.disconnect.mock.mockImplementation(async () => {
    if (mode === 'disconnect') throw Error('disconnect')
  })
  redis.connect.mock.mockImplementation(async () => {
    redis.isOpen = true
    if (mode === 'redis') throw Error('redis')
  })
  redis.close.mock.mockImplementation(async () => {
    if (mode === 'redis-close') throw Error('redis-close')
    redis.isOpen = false
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
  once.mock.restore()
  exit.mock.restore()
  timer.mock.restore()
  clear.mock.restore()
  process.exitCode = 0
})
let sequence = 0
const start = () =>
  import(`../../../../dist/app/runtime/server.js?case=${++sequence}`)
const settle = async () => {
  for (let i = 0; i < 8; i++) await setImmediate()
}
test('server starts and drains once across repeated termination signals', async () => {
  await start()
  assert(server.listening)
  assert.equal(server.requestTimeout, 30000)
  handlers.SIGTERM()
  handlers.SIGINT()
  await settle()
  assert.equal(server.close.mock.callCount(), 1)
  assert.equal(db.disconnect.mock.callCount(), 1)
  assert.equal(stop.mock.callCount(), 1)
  assert.equal(process.exitCode, 0)
})
for (const failure of ['storage', 'mongodb', 'redis', 'listen'])
  test(`startup ${failure} failure closes resources and exits unsuccessfully`, async () => {
    mode = failure
    await start()
    assert.equal(process.exitCode, 1)
    assert.equal(db.disconnect.mock.callCount(), 1)
    assert.equal(logger.error.mock.calls[0].arguments[0], 'API startup failed')
  })
for (const failure of ['close', 'disconnect', 'redis-close'])
  test(`shutdown ${failure} failure is reported`, async () => {
    await start()
    mode = failure
    handlers.SIGTERM()
    await settle()
    assert.equal(process.exitCode, 1)
    assert(logger.error.mock.callCount() > 0)
    if (failure === 'redis-close')
      assert.equal(redis.destroy.mock.callCount(), 1)
  })
for (const event of ['uncaughtException', 'unhandledRejection', 'error'])
  test(`runtime ${event} initiates fatal shutdown`, async () => {
    await start()
    if (event === 'error') server.emit(event, Error('fatal'))
    else handlers[event](Error('fatal'))
    await settle()
    assert.equal(process.exitCode, 1)
    assert.equal(db.disconnect.mock.callCount(), 1)
  })
test('shutdown deadline force-closes active HTTP connections', async () => {
  await start()
  handlers.SIGTERM()
  timeout()
  await settle()
  assert.equal(server.closeAllConnections.mock.callCount(), 1)
  assert.deepEqual(exit.mock.calls[0].arguments, [1])
})
test('unexpected shutdown failure reports fatal exit', async () => {
  await start()
  stop.mock.mockImplementation(() => {
    throw Error('observer')
  })
  handlers.SIGTERM()
  await settle()
  assert.equal(report.mock.calls[0].arguments[1].stage, 'shutdown')
  assert.equal(exit.mock.callCount(), 1)
})
