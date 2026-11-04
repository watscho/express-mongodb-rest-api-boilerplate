import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  methods,
  user,
  database,
  session,
  reset
} from '../../../../__tests__/helpers.mjs'
const users = methods(['lockCurrent', 'getById', 'updateEmail'])
const notifications = methods(['cancelPending', 'enqueueAccount'])
const repo = methods(['deleteForUser', 'create', 'consume'])
replace('app/database/mongodb.js', { database })
replace('domains/users/index.js', { userService: users })
replace('domains/notifications/index.js', {
  notificationService: notifications
})
replace('domains/auth/verification/repository.js', {
  verificationRepository: repo
})
replace('domains/auth/utils.js', {
  createEmailToken: () => ({ accessToken: 'token', expiresIn: new Date() }),
  jwtSign: () => ({ accessToken: 'jwt' })
})
const { verificationService: v } =
  await import('../../../../../dist/domains/auth/verification/service.js')
beforeEach(() => {
  reset(users, notifications, repo, database)
  users.lockCurrent.mock.mockImplementation(async () => user)
  users.getById.mock.mockImplementation(async () => user)
  users.updateEmail.mock.mockImplementation(async () => ({
    ...user,
    verified: true
  }))
  repo.consume.mock.mockImplementation(async () => ({
    userId: user.id,
    email: user.email
  }))
})
test('issue locks current version and replaces verification in same session', async () => {
  await v.issue(user, session, 'ka')
  assert.equal(repo.create.mock.calls[0].arguments[1], session)
  assert.equal(notifications.cancelPending.mock.callCount(), 1)
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'verification'
  )
})
test('verification request cannot change email', async () => {
  await assert.rejects(() => v.request(user, { email: 'other@example.test' }), {
    messageKey: 'auth.email_change_requires_password'
  })
  assert.equal(database.transaction.mock.callCount(), 0)
})
test('verification request uses transaction', async () => {
  await v.request(user, { email: user.email })
  assert.equal(database.transaction.mock.callCount(), 1)
})
test('confirmation consumes token marks verified cancels old jobs and notifies', async () => {
  assert.equal((await v.confirm('token')).accessToken, 'jwt')
  assert.deepEqual(users.updateEmail.mock.calls[0].arguments, [
    user.id,
    user.email,
    true,
    session
  ])
  assert.equal(repo.deleteForUser.mock.callCount(), 1)
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'successfullyVerified'
  )
})
for (const mode of ['token', 'user', 'email', 'update'])
  test(`confirmation rejects invalid ${mode}`, async () => {
    if (mode === 'token') repo.consume.mock.mockImplementation(async () => null)
    if (mode === 'user') users.getById.mock.mockImplementation(async () => null)
    if (mode === 'email')
      users.getById.mock.mockImplementation(async () => ({
        ...user,
        email: 'changed@example.test'
      }))
    if (mode === 'update')
      users.updateEmail.mock.mockImplementation(async () => null)
    await assert.rejects(() => v.confirm('token'), { status: 403 })
  })
