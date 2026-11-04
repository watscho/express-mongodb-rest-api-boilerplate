import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { replace, logger } from '../../../../__tests__/helpers.mjs'
const connection = new EventEmitter()
mock.module('mongoose', { exports: { default: { connection } } })
replace('app/runtime/logger.js', { logger })
const { observeMongoDB } =
  await import('../../../../../dist/app/runtime/diagnostics/mongodb.js')
test('MongoDB observer suppresses startup loss, deduplicates disconnect and removes listeners', () => {
  const stop = observeMongoDB('unit')
  connection.emit('disconnected')
  connection.emit('error', Error('initial'))
  assert.equal(logger.warn.mock.callCount(), 0)
  assert.equal(logger.error.mock.callCount(), 0)
  connection.emit('connected')
  connection.emit('disconnected')
  connection.emit('disconnected')
  assert.equal(logger.warn.mock.callCount(), 1)
  connection.emit('error', Error('private'))
  assert.equal(logger.error.mock.callCount(), 1)
  connection.emit('connected')
  assert.equal(
    logger.info.mock.calls.at(-1).arguments[1].code,
    'MONGODB_RECONNECTED'
  )
  stop()
  assert.equal(connection.listenerCount('connected'), 0)
  assert.equal(connection.listenerCount('error'), 0)
})
