import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { replace, logger } from '../../../__tests__/helpers.mjs'
const client = new EventEmitter()
let options
mock.module('redis', {
  exports: {
    createClient: input => {
      options = input
      return client
    }
  }
})
replace('app/runtime/logger.js', { logger })
await import('../../../../dist/app/database/redis.js')
test('Redis disables offline queue and bounds startup reconnect attempts', () => {
  assert.equal(options.disableOfflineQueue, true)
  assert.equal(options.socket.reconnectStrategy(0), 100)
  assert.equal(options.socket.reconnectStrategy(4), 1600)
  assert.equal(
    options.socket.reconnectStrategy(5).diagnostic.code,
    'REDIS_STARTUP_EXHAUSTED'
  )
})
test('Redis deduplicates repeated errors and recovers after established connection', () => {
  const error = Object.assign(Error('private'), { code: 'ECONNREFUSED' })
  client.emit('error', error)
  client.emit('error', error)
  assert.equal(logger.error.mock.callCount(), 1)
  client.emit('ready')
  client.emit('error', error)
  client.emit('ready')
  assert.equal(
    logger.info.mock.calls.at(-1).arguments[1].code,
    'REDIS_RECONNECTED'
  )
  assert.equal(options.socket.reconnectStrategy(100), 3000)
})
