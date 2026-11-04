import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  modelDouble,
  methods
} from '../../../../__tests__/helpers.mjs'
const outbox = modelDouble(),
  workers = modelDouble()
const repo = methods(['getDelivery', 'retryFailed'])
replace('domains/notifications/delivery/model.js', {
  EmailOutbox: outbox.Model,
  EmailWorker: workers.Model
})
replace('domains/notifications/delivery/repository.js', {
  deliveryRepository: repo
})
const { deliveryOperations: o, workerRepository: w } =
  await import('../../../../../dist/domains/notifications/delivery/operations.js')
const now = new Date()
const row = {
  _id: 'a'.repeat(64),
  status: 'failed',
  template: 'signUp',
  attempts: 1,
  maxAttempts: 8,
  createdAt: now,
  updatedAt: now,
  expiresAt: now,
  availableAt: now
}
beforeEach(() => {
  outbox.reset()
  workers.reset()
})
test('list paginates and emits resumable cursor with sensitive fields excluded', async () => {
  outbox.setResult([row, { ...row, _id: 'b'.repeat(64) }])
  const first = await o.list({ limit: 1 })
  assert.equal(first.items.length, 1)
  const cursor = JSON.parse(
    Buffer.from(first.nextCursor, 'base64url').toString()
  )
  assert.equal(cursor.id, row._id)
  assert(!('payload' in first.items[0]))
  outbox.setResult([])
  const second = await o.list({ cursor: first.nextCursor })
  assert.equal(second.nextCursor, undefined)
  assert(outbox.Model.find.mock.calls[1].arguments[0].$or)
  assert(outbox.query.select.mock.calls[0].arguments[0].includes('-payload'))
})
for (const options of [
  { limit: 0 },
  { limit: 101 },
  { status: 'unknown' },
  { cursor: '!' }
])
  test(`invalid queue list ${JSON.stringify(options)}`, async () =>
    assert.rejects(() => o.list(options), {
      messageKey: 'notifications.invalid_list_options'
    }))
for (const cursor of [
  'bm90LWpzb24',
  Buffer.from(JSON.stringify({ id: 'bad', createdAt: 'invalid' })).toString(
    'base64url'
  )
])
  test(`invalid opaque cursor ${cursor}`, async () =>
    assert.rejects(() => o.list({ cursor }), {
      messageKey: 'notifications.invalid_cursor'
    }))
test('worker snapshots distinguish stale heartbeats and support health', async () => {
  workers.setResult([
    {
      _id: 'worker',
      status: 'running',
      startedAt: now,
      lastSeenAt: new Date(0),
      concurrency: 2,
      activeJobs: 1
    }
  ])
  assert.equal((await w.list())[0].stale, true)
  workers.setResult(null)
  assert.equal(await w.healthy(), false)
  workers.setResult({ _id: 'worker' })
  assert.equal(await w.healthy(), true)
})
test('heartbeat uses upsert and bounded retention', async () => {
  await w.report({
    id: 'worker',
    status: 'running',
    startedAt: now,
    concurrency: 2,
    activeJobs: 0
  })
  const [filter, update, opts] = workers.Model.updateOne.mock.calls[0].arguments
  assert.equal(filter._id, 'worker')
  assert(update.$set.expiresAt > now)
  assert.equal(opts.upsert, true)
})
test('stats returns counts age and active workers without message content', async () => {
  outbox.setResult(0)
  workers.setResult(2)
  const stats = await o.stats()
  assert.equal(stats.activeWorkers, 2)
  assert.equal(stats.oldestQueuedAgeMs, null)
  assert.equal(stats.counts.failed, 0)
  assert.equal(Object.keys(stats.counts).length, 6)
})
test('queue defaults and oldest backlog age are reported', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 0, 1) })
  outbox.setResult([])
  assert.deepEqual((await o.list()).items, [])
  const q = {
    select() {
      return q
    },
    sort() {
      return q
    },
    maxTimeMS() {
      return q
    },
    lean() {
      return q
    },
    exec: async () => ({ createdAt: new Date(Date.now() - 10000) })
  }
  outbox.Model.findOne.mock.mockImplementation(() => q)
  outbox.setResult(0)
  workers.setResult(0)
  assert.equal((await o.stats()).oldestQueuedAgeMs, 10000)
})
