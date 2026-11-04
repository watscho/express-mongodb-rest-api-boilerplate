import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  methods,
  user,
  database,
  session,
  reset
} from '../../../__tests__/helpers.mjs'
const repo = methods([
  'getById',
  'getByEmail',
  'getCredentialsById',
  'getCredentialsByEmail',
  'existsByEmail',
  'create',
  'lock',
  'updatePassword',
  'updateEmail',
  'delete',
  'updateProfile'
])
const notifications = methods(['enqueueAccount'])
replace('app/database/mongodb.js', { database })
replace('domains/notifications/index.js', {
  notificationService: notifications
})
replace('domains/users/repository.js', { userRepository: repo })
const { userService: u } =
  await import('../../../../dist/domains/users/service.js')
beforeEach(() => {
  reset(repo, notifications, database)
  repo.lock.mock.mockImplementation(async () => user)
})
test('facade exposes repository reads directly', () =>
  assert.equal(u.getById, repo.getById))
test('lockCurrent compares auth version and rejects vanished or superseded account', async () => {
  assert.equal(await u.lockCurrent(user, session), user)
  assert.deepEqual(repo.lock.mock.calls[0].arguments, [
    user.id,
    session,
    user.authVersion
  ])
  repo.lock.mock.mockImplementation(async () => null)
  await assert.rejects(() => u.lockCurrent(user, session), { status: 401 })
})
test('profile update and email share transaction', async () => {
  const payload = { firstName: 'Unit', lastName: 'Test', admin: true }
  assert.deepEqual(await u.updateProfile(user, payload, 'ka'), {
    firstName: 'Unit',
    lastName: 'Test'
  })
  assert.equal(repo.updateProfile.mock.calls[0].arguments[2], session)
  assert.equal(notifications.enqueueAccount.mock.calls[0].arguments[2], session)
})
test('stale account cannot update profile', async () => {
  repo.lock.mock.mockImplementation(async () => null)
  await assert.rejects(() => u.updateProfile(user, {}), { status: 401 })
  assert.equal(repo.updateProfile.mock.callCount(), 0)
})
test('unchanged profile does not consume notification budget or update persistence', async () => {
  repo.lock.mock.mockImplementation(async () => ({
    ...user,
    firstName: 'Unit',
    lastName: 'Test'
  }))
  await u.updateProfile(user, { firstName: 'Unit', lastName: 'Test' })
  assert.equal(repo.updateProfile.mock.callCount(), 0)
  assert.equal(notifications.enqueueAccount.mock.callCount(), 0)
})
