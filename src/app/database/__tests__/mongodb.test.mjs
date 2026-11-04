import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
const calls = {}
const mongoose = {
  set: () => {},
  connect: mock.fn(async (...args) => {
    calls.connect = args
  }),
  disconnect: mock.fn(),
  connection: {
    transaction: mock.fn(async (fn, options) => {
      calls.options = options
      return fn('session')
    })
  }
}
mock.module('mongoose', { exports: { default: mongoose } })
replace('app/config/database.js', {
  databaseEnv: {
    MONGODB_URI: 'mongodb://unit',
    MONGODB_AUTO_INDEX: false,
    MONGODB_MAX_POOL_SIZE: 20
  }
})
const { database } = await import('../../../../dist/app/database/mongodb.js')
test('connect defaults disable automatic DDL and require majority writes', async () => {
  await database.connect()
  assert.equal(calls.connect[1].autoIndex, false)
  assert.equal(calls.connect[1].autoCreate, false)
  assert.deepEqual(calls.connect[1].writeConcern, { w: 'majority' })
  await database.connect({ autoIndex: true })
  assert.equal(calls.connect[1].autoIndex, true)
})
test('transactions use primary snapshot majority and preserve return/rejection', async () => {
  assert.equal(await database.transaction(async session => session), 'session')
  assert.deepEqual(calls.options, {
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' }
  })
  await assert.rejects(
    () =>
      database.transaction(async () => {
        throw Error('rollback')
      }),
    /rollback/
  )
  await database.disconnect()
  assert.equal(mongoose.disconnect.mock.callCount(), 1)
})
