import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { replace } from '../../../__tests__/helpers.mjs'
let settings
const instance = new EventEmitter(),
  report = mock.fn()
const format = fn => () => ({ transform: fn })
format.combine = (...items) => items
format.timestamp = () => ({ timestamp: true })
format.printf = fn => ({ printf: fn })
format.json = () => ({ json: true })
const env = { LOG_LEVEL: 'info' }
mock.module('winston', {
  exports: {
    createLogger: options => {
      settings = options
      return instance
    },
    format,
    transports: {
      Console: class {
        constructor(options) {
          this.options = options
        }
      },
      File: class {
        constructor(options) {
          this.options = options
        }
      }
    }
  }
})
replace('app/config/runtime.js', { runtimeEnv: env })
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
test('logger formats sanitized records and separates stderr levels', async () => {
  await import('../../../../dist/app/runtime/logger.js?development')
  const sanitize = settings.format[1].transform
  let record = sanitize({
    message: 'Value',
    level: 'info',
    password: 'secret',
    timestamp: 'fixed',
    [Symbol.for('level')]: 'info'
  })
  assert.equal(record.password, '[redacted]')
  assert.equal(record.timestamp, 'fixed')
  assert.equal(record.message, 'Value')
  record = sanitize({ message: 42, level: 'info' })
  assert.equal(record.message, 'Log event')
  assert(record.timestamp)
  assert(
    settings.transports[0].options.format.printf(record).includes('Log event')
  )
  assert.deepEqual(settings.transports[0].options.stderrLevels, [
    'error',
    'warn'
  ])
  instance.emit('error', Error('sink'))
  assert.equal(report.mock.calls[0].arguments[1].stage, 'log_output')
})
test('production logger uses JSON and optional file transport', async () => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  env.API_LOG_FILENAME = '/unit/log.json'
  try {
    await import('../../../../dist/app/runtime/logger.js?production')
    assert.equal(settings.transports.length, 2)
    assert(settings.transports[0].options.format.json)
    assert.equal(settings.transports[1].options.filename, '/unit/log.json')
  } finally {
    process.env.NODE_ENV = before
  }
})
