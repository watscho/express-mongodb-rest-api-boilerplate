import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
const evaluate = mock.fn(async () => 0)
replace('app/database/redis.js', { redis: { eval: evaluate } })
const { consumeAccountBudget } =
  await import('../../../../dist/domains/auth/admission.js')
test('account limits share normalized HMAC identity across callers and keep operations separate', async () => {
  await consumeAccountBudget(' Unit@EXAMPLE.test ', 'sign-in')
  await consumeAccountBudget('unit@example.test', 'sign-in')
  await consumeAccountBudget('unit@example.test', 'confirmation')
  const calls = evaluate.mock.calls.map(call => call.arguments[1])
  assert.equal(calls[0].keys[0], calls[1].keys[0])
  assert.notEqual(calls[1].keys[0], calls[2].keys[0])
  assert(!calls[0].keys[0].includes('unit@example'))
  assert.deepEqual(calls[0].arguments, ['900000', '20'])
})
test('denied account attempts return bounded retry header metadata and dependency errors fail closed', async () => {
  evaluate.mock.mockImplementation(async () => 1501)
  await assert.rejects(
    () => consumeAccountBudget('unit@example.test', 'sign-in'),
    { status: 429, retryAfterSeconds: 2 }
  )
  evaluate.mock.mockImplementation(async () => {
    throw Error('redis unavailable')
  })
  await assert.rejects(
    () => consumeAccountBudget('unit@example.test', 'sign-in'),
    /redis unavailable/
  )
})
