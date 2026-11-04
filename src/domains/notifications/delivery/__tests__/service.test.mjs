import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  methods,
  reset,
  session,
  user
} from '../../../../__tests__/helpers.mjs'
const repo = methods(['enqueue'])
replace('domains/notifications/delivery/repository.js', {
  deliveryRepository: repo
})
const { enqueueTemplate } =
  await import('../../../../../dist/domains/notifications/delivery/service.js')
const { decryptDelivery } =
  await import('../../../../../dist/domains/notifications/delivery/utils.js')
const input = { email: 'unit@example.test', template: 'signUp' }
beforeEach(() => {
  reset(repo)
  repo.enqueue.mock.mockImplementation(async job => ({
    ...job,
    _id: job.id,
    status: 'queued'
  }))
})
test('enqueue encrypts validated notification and passes caller session', async () => {
  const result = await enqueueTemplate(input, { session })
  const job = repo.enqueue.mock.calls[0].arguments[0]
  assert.equal(result.id, job.id)
  assert.equal(repo.enqueue.mock.calls[0].arguments[1], session)
  assert.equal(decryptDelivery(job.id, job.payload).email, input.email)
  assert.equal(job.purpose, 'custom')
  assert(job.expiresAt > Date.now())
  assert.equal(job.maxAttempts, 8)
})
test('idempotency keys select deterministic job IDs and content fingerprint', async () => {
  const a = await enqueueTemplate(input, {
    options: { idempotencyKey: 'unique' }
  })
  const b = await enqueueTemplate(input, {
    options: { idempotencyKey: 'unique' }
  })
  assert.equal(a.id, b.id)
  assert.match(a.id, /^[a-f0-9]{64}$/)
})
test('expiry is capped by caller deadline', async () => {
  const date = new Date(Date.now() + 10000)
  await enqueueTemplate(input, { options: { expiresAt: date } })
  assert.equal(
    repo.enqueue.mock.calls[0].arguments[0].expiresAt.getTime(),
    date.getTime()
  )
})
for (const options of [
  { purpose: 'account' },
  { ownerId: 'bad' },
  { idempotencyKey: '' },
  { purpose: 'invalid' }
])
  test(`invalid options ${JSON.stringify(options)}`, async () => {
    await assert.rejects(() => enqueueTemplate(input, { options }), {
      messageKey: 'notifications.invalid_queue_options'
    })
    assert.equal(repo.enqueue.mock.callCount(), 0)
  })
test('owned account purpose accepted and expired mail rejected', async () => {
  await enqueueTemplate(input, {
    options: { purpose: 'account', ownerId: user.id }
  })
  await assert.rejects(
    () => enqueueTemplate(input, { options: { expiresAt: new Date(0) } }),
    { messageKey: 'notifications.already_expired' }
  )
})
test('missing job and idempotency conflicts propagate', async () => {
  repo.enqueue.mock.mockImplementation(async () => null)
  await assert.rejects(() => enqueueTemplate(input), {
    messageKey: 'notifications.enqueue_failed'
  })
  repo.enqueue.mock.mockImplementation(async () => ({
    fingerprint: 'different'
  }))
  await assert.rejects(() => enqueueTemplate(input), {
    status: 409,
    messageKey: 'notifications.idempotency_conflict'
  })
})
