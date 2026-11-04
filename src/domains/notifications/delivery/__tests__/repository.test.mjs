import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  modelDouble,
  session
} from '../../../../__tests__/helpers.mjs'
const m = modelDouble()
replace('domains/notifications/delivery/model.js', { EmailOutbox: m.Model })
const { deliveryRepository: r } =
  await import('../../../../../dist/domains/notifications/delivery/repository.js')
const now = new Date()
const row = {
  _id: 'job',
  template: 'signUp',
  status: 'queued',
  attempts: 0,
  maxAttempts: 8,
  expiresAt: new Date(Date.now() + 10000),
  createdAt: now,
  updatedAt: now,
  availableAt: now,
  payload: 'encrypted'
}
const job = { id: 'job', leaseToken: 'lease', maxAttempts: 8 }
beforeEach(() => m.reset())
test('enqueue uses insert-only state and derives retention from expiry', async () => {
  m.setResult(row)
  await r.enqueue(
    { id: 'job', expiresAt: row.expiresAt, payload: 'encrypted' },
    session
  )
  const [filter, update, options] =
    m.Model.findOneAndUpdate.mock.calls[0].arguments
  assert.deepEqual(filter, { _id: 'job' })
  assert.equal(update.$setOnInsert.attempts, 0)
  assert(update.$setOnInsert.purgeAt > row.expiresAt)
  assert.equal(options.session, session)
})
test('duplicate upsert recovery only outside a transaction', async () => {
  const duplicate = Object.assign(Error('duplicate'), { code: 11000 })
  m.Model.findOneAndUpdate.mock.mockImplementation(() => {
    throw duplicate
  })
  m.setResult(row)
  assert.equal(await r.enqueue({ id: 'job', expiresAt: now }), row)
  await assert.rejects(
    () => r.enqueue({ id: 'job', expiresAt: now }, session),
    e => e === duplicate
  )
})
test('other enqueue errors propagate', async () => {
  m.Model.findOneAndUpdate.mock.mockImplementation(() => {
    throw Error('unavailable')
  })
  await assert.rejects(
    () => r.enqueue({ id: 'job', expiresAt: now }),
    /unavailable/
  )
})
test('claim recovers expired processing lease before queued work', async () => {
  m.setResult(row)
  const claimed = await r.claim()
  assert.equal(claimed.id, 'job')
  assert.match(claimed.leaseToken, /^[a-f0-9-]{36}$/)
  assert.equal(m.Model.findOneAndUpdate.mock.callCount(), 1)
  assert.equal(
    m.Model.findOneAndUpdate.mock.calls[0].arguments[0].status,
    'processing'
  )
})
test('empty claim checks processing then due queued jobs', async () => {
  assert.equal(await r.claim(), null)
  assert.equal(m.Model.findOneAndUpdate.mock.callCount(), 2)
  assert.equal(
    m.Model.findOneAndUpdate.mock.calls[1].arguments[0].status,
    'queued'
  )
})
test('startAttempt requires live owned lease and attempt budget', async () => {
  assert.equal(await r.startAttempt(job), null)
  const [filter, update] = m.Model.findOneAndUpdate.mock.calls[0].arguments
  assert.equal(filter.leaseToken, 'lease')
  assert.equal(filter.status, 'processing')
  assert(filter.lockedUntil.$gt instanceof Date)
  assert.deepEqual(filter.attempts, { $lt: 8 })
  assert.deepEqual(update, { $inc: { attempts: 1 } })
  m.setResult(row)
  assert.equal((await r.startAttempt(job)).leaseToken, 'lease')
})
for (const method of ['renew', 'finish', 'retry'])
  test(`${method} rejects lost lease and accepts exactly one match`, async () => {
    m.setResult({ matchedCount: 0 })
    assert.equal(
      await r[method](
        job,
        method === 'finish' ? 'sent' : now,
        'smtp.temporary'
      ),
      false
    )
    m.setResult({ matchedCount: 1 })
    assert.equal(
      await r[method](
        job,
        method === 'finish' ? 'sent' : now,
        'smtp.temporary'
      ),
      true
    )
    const filter = m.Model.updateOne.mock.calls[0].arguments[0]
    assert.equal(filter.leaseToken, 'lease')
    assert.equal(filter._id, 'job')
  })
for (const status of ['sent', 'failed', 'expired'])
  test(`finish ${status} payload retention`, async () => {
    m.setResult({ matchedCount: 1 })
    await r.finish(job, status)
    const update = m.Model.updateOne.mock.calls[0].arguments[1]
    assert.equal('payload' in update.$unset, status !== 'failed')
    assert.equal(update.$set.status, status)
    assert('leaseToken' in update.$unset)
  })
test('cancel removes sensitive payload for owned purposes in caller session', async () => {
  await r.cancelPending('owner', session, ['verification'])
  const [filter, update, options] = m.Model.updateMany.mock.calls[0].arguments
  assert.equal(filter.ownerId, 'owner')
  assert.deepEqual(filter.purpose, { $in: ['verification'] })
  assert.equal(update.$unset.payload, 1)
  assert.equal(options.session, session)
})
test('delivery lookup hides private fields and handles absence', async () => {
  assert.equal(await r.getDelivery('job'), null)
  m.setResult(row)
  assert.equal((await r.getDelivery('job')).id, 'job')
  assert(m.query.select.mock.calls[0].arguments[0].includes('-payload'))
})
test('retry only permits unexpired failed jobs with retained payload', async () => {
  assert.equal(await r.retryFailed('job'), null)
  const filter = m.Model.findOneAndUpdate.mock.calls[0].arguments[0]
  assert.equal(filter.status, 'failed')
  assert.equal(filter.payload.$type, 'string')
  assert(filter.expiresAt.$gt instanceof Date)
  m.setResult(row)
  assert.equal((await r.retryFailed('job')).id, 'job')
})
test('cancelling all pending purposes does not add purpose filter', async () => {
  await r.cancelPending('owner', session)
  assert(!('purpose' in m.Model.updateMany.mock.calls[0].arguments[0]))
})
