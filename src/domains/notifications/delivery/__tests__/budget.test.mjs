import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  modelDouble,
  session
} from '../../../../__tests__/helpers.mjs'
const m = modelDouble()
replace('domains/notifications/delivery/budget-model.js', {
  EmailBudget: m.Model
})
const { admitEmail } =
  await import('../../../../../dist/domains/notifications/delivery/budget.js')
beforeEach(() => m.reset())
const row = (
  used = 0,
  nextAllowedAt = new Date(0),
  day = new Date().toISOString().slice(0, 10)
) => ({ used, nextAllowedAt, day })
test('recipient and template budgets use hashed normalized keys in the same transaction', async () => {
  m.setResult(row())
  await admitEmail(' UNIT@example.test ', 'signUp', session)
  assert.equal(m.Model.findOneAndUpdate.mock.callCount(), 2)
  assert.equal(m.Model.updateOne.mock.callCount(), 2)
  for (const call of m.Model.findOneAndUpdate.mock.calls) {
    assert.match(call.arguments[0]._id, /^[a-f0-9]{64}$/)
    assert.equal(call.arguments[2].session, session)
  }
  assert(
    !JSON.stringify(m.Model.findOneAndUpdate.mock.calls).includes(
      'UNIT@example'
    )
  )
  const old = m.Model.findOneAndUpdate.mock.calls[0].arguments[0]._id
  await admitEmail('unit@example.test', 'signUp', session)
  assert.equal(m.Model.findOneAndUpdate.mock.calls[2].arguments[0]._id, old)
})
test('expired day resets counts without bypassing an active link cooldown', async () => {
  m.setResult(row(100, new Date(0), '2000-01-01'))
  await admitEmail('unit@example.test', 'resetPassword', session)
  assert.equal(m.Model.updateOne.mock.calls[0].arguments[1].$set.used, 1)
  assert(
    m.Model.updateOne.mock.calls[1].arguments[1].$set.nextAllowedAt > Date.now()
  )
  m.setResult(row(0, new Date(Date.now() + 60000), '2000-01-01'))
  await assert.rejects(
    () => admitEmail('unit@example.test', 'resetPassword', session),
    { status: 429 }
  )
})
test('exhausted daily budget rejects before enqueue and includes a useful retry interval', async () => {
  m.setResult(row(50))
  await assert.rejects(
    () => admitEmail('unit@example.test', 'signUp', session),
    error => error.status === 429 && error.retryAfterSeconds > 0
  )
  assert.equal(m.Model.updateOne.mock.callCount(), 0)
})
test('missing budget state and insertion races fail closed', async () => {
  await assert.rejects(
    () => admitEmail('unit@example.test', 'signUp', session),
    { status: 503 }
  )
  m.Model.findOneAndUpdate.mock.mockImplementation(() => {
    throw Object.assign(Error('duplicate'), { code: 11000 })
  })
  await assert.rejects(
    () => admitEmail('unit@example.test', 'signUp', session),
    { status: 429 }
  )
  m.Model.findOneAndUpdate.mock.mockImplementation(() => {
    throw Error('unavailable')
  })
  await assert.rejects(
    () => admitEmail('unit@example.test', 'signUp', session),
    /unavailable/
  )
})
