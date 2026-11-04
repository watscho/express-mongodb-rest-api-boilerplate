import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../../__tests__/helpers.mjs'
const calls = []
mock.module('express-rate-limit', {
  exports: {
    rateLimit: options => {
      calls.push(options)
      return options
    }
  }
})
mock.module('rate-limit-redis', {
  exports: {
    RedisStore: class {
      constructor(options) {
        this.options = options
      }
    }
  }
})
const sendCommand = mock.fn(async () => 1)
replace('app/database/redis.js', { redis: { sendCommand } })
const { createRateLimits } =
  await import('../../../../../dist/app/http/middlewares/rateLimit.js')
test('rate limits use independent Redis prefixes, fail closed and forward commands', async () => {
  const limits = createRateLimits()
  assert.equal(calls.length, 2)
  assert.equal(limits.apiRateLimit.store.options.prefix, 'rateLimit:api:')
  assert.equal(limits.authRateLimit.store.options.prefix, 'rateLimit:auth:')
  for (const options of calls) {
    assert.equal(options.passOnStoreError, false)
    assert.equal(options.message.status, 429)
    assert.equal(options.standardHeaders, 'draft-8')
  }
  await calls[0].store.options.sendCommand('GET', 'key')
  assert.deepEqual(sendCommand.mock.calls[0].arguments, [['GET', 'key']])
})
