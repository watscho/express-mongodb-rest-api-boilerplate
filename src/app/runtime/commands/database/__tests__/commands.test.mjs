import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  replace,
  methods,
  logger,
  reset
} from '../../../../../__tests__/helpers.mjs'
const db = methods(['connect', 'disconnect'])
const report = mock.fn()
let conflicts = false,
  documents = [],
  connection = true
const models = {}
for (const name of [
  'User',
  'Media',
  'ResetPassword',
  'Verification',
  'EmailOutbox',
  'EmailWorker'
]) {
  const collection = {
    name,
    ...methods(['updateMany', 'updateOne', 'countDocuments']),
    aggregate: mock.fn(() => ({
      toArray: async () => (conflicts ? [{ count: 2 }] : [])
    })),
    find: () => documents
  }
  const model = {
    modelName: name,
    collection,
    ...methods(['createCollection', 'createIndexes'])
  }
  models[name] = model
}
models.User.db = {
  get db() {
    return connection
      ? { collection: name => models[name].collection }
      : undefined
  }
}
replace('app/database/mongodb.js', { database: db })
replace('app/config/process.js', { loadProcessConfiguration: async () => {} })
replace('app/runtime/logger.js', { logger })
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
for (const [path, exports] of [
  ['users', { User: models.User }],
  ['media', { Media: models.Media }],
  ['auth', { ResetPassword: models.ResetPassword }],
  ['auth/verification', { Verification: models.Verification }],
  [
    'notifications/delivery',
    { EmailOutbox: models.EmailOutbox, EmailWorker: models.EmailWorker }
  ]
])
  replace(`domains/${path}/model.js`, exports)
beforeEach(() => {
  process.exitCode = 0
  conflicts = false
  documents = []
  connection = true
  reset(db, logger, { report })
  for (const model of Object.values(models)) {
    reset(model)
    reset(model.collection)
  }
})
afterEach(() => {
  process.exitCode = 0
})
let sequence = 0
const run = name =>
  import(
    `../../../../../../dist/app/runtime/commands/database/${name}.js?case=${++sequence}`
  )
test('index preflight checks uniqueness before creating every model collection/index', async () => {
  await run('indexes')
  assert.equal(process.exitCode, 0)
  for (const model of Object.values(models)) {
    assert.equal(model.createIndexes.mock.callCount(), 1)
    assert.equal(model.createCollection.mock.callCount(), 1)
  }
  assert.equal(
    models.User.collection.aggregate.mock.calls[0].arguments[0][1].$group._id,
    '$email'
  )
})
test('index conflict prevents all DDL', async () => {
  conflicts = true
  await run('indexes')
  assert.equal(process.exitCode, 1)
  assert.equal(models.User.createIndexes.mock.callCount(), 0)
  assert.equal(db.disconnect.mock.callCount(), 1)
})
for (const name of ['indexes', 'migrate'])
  test(`${name} connection failure and disconnect failure are reported`, async () => {
    db.connect.mock.mockImplementation(async () => {
      throw Error('connect')
    })
    db.disconnect.mock.mockImplementation(async () => {
      throw Error('disconnect')
    })
    await run(name)
    assert.equal(process.exitCode, 1)
    assert.equal(report.mock.calls.at(-1).arguments[1].stage, 'shutdown')
  })
test('legacy migration hashes and removes raw tokens and proves attached ownership', async () => {
  documents = [
    { _id: 'id', accessToken: 'raw-secret' },
    { _id: 'invalid', accessToken: 12 }
  ]
  await run('migrate')
  assert.equal(process.exitCode, 0)
  assert.equal(models.User.collection.updateMany.mock.callCount(), 2)
  const update =
    models.ResetPassword.collection.updateOne.mock.calls[0].arguments[1]
  assert.equal(
    update.$set.tokenHash,
    createHash('sha256').update('raw-secret').digest('hex')
  )
  assert.deepEqual(update.$unset, { accessToken: '' })
  assert.equal(models.ResetPassword.collection.updateOne.mock.callCount(), 1)
  assert.deepEqual(
    models.Media.collection.updateMany.mock.calls[0].arguments[1],
    [{ $set: { owner: '$refId' } }]
  )
})
test('legacy migration refuses token access without connected database', async () => {
  connection = false
  await run('migrate')
  assert.equal(process.exitCode, 1)
  assert.equal(db.disconnect.mock.callCount(), 1)
})
