import { test, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  methods,
  replace,
  user,
  session,
  database,
  reset
} from '../../../__tests__/helpers.mjs'
const users = methods([
  'getCredentialsById',
  'getCredentialsByEmail',
  'existsByEmail',
  'create',
  'lock',
  'updatePassword',
  'updateEmail',
  'lockCurrent',
  'delete',
  'getByEmail'
])
const notifications = methods(['enqueueAccount', 'cancelPending'])
const verification = methods(['issue', 'invalidate'])
const tokens = methods(['deleteResets', 'consumeReset', 'createReset'])
const media = methods(['deleteOwned', 'cleanupFiles'])
const redis = methods(['set'])
const bcrypt = { compare: mock.fn(async () => true) }
const utils = {
  hashPassword: mock.fn(async () => 'hashed'),
  createEmailToken: () => ({
    accessToken: 'mail-token',
    expiresIn: new Date(Date.now() + 86400000)
  }),
  hashToken: () => 'digest',
  jwtSign: () => ({ accessToken: 'jwt' })
}
replace('app/database/mongodb.js', { database })
replace('app/database/redis.js', { redis })
replace('domains/users/index.js', { userService: users })
replace('domains/notifications/index.js', {
  notificationService: notifications
})
replace('domains/auth/verification/index.js', {
  verificationService: verification
})
replace('domains/auth/repository.js', { tokenRepository: tokens })
replace('domains/media/index.js', { mediaService: media })
replace('domains/auth/utils.js', utils)
mock.module('bcrypt', { exports: bcrypt })
const { authService: a } =
  await import('../../../../dist/domains/auth/service.js')
beforeEach(() => {
  reset(
    users,
    notifications,
    verification,
    tokens,
    media,
    redis,
    bcrypt,
    database
  )
  users.getCredentialsById.mock.mockImplementation(async () => ({
    ...user,
    password: 'hash'
  }))
  users.getCredentialsByEmail.mock.mockImplementation(async () => ({
    ...user,
    password: 'hash'
  }))
  users.create.mock.mockImplementation(async () => user)
  users.lock.mock.mockImplementation(async () => user)
  users.updatePassword.mock.mockImplementation(async () => user)
  users.updateEmail.mock.mockImplementation(async () => user)
  users.getByEmail.mock.mockImplementation(async () => user)
  bcrypt.compare.mock.mockImplementation(async () => true)
})
const credentials = { email: user.email, password: 'secret' }
test('signup hashes password and enqueues welcome/verification within same transaction', async () => {
  assert.equal((await a.signUp(credentials, 'ka')).accessToken, 'jwt')
  assert.deepEqual(users.create.mock.calls[0].arguments, [
    { email: user.email, password: 'hashed' },
    session
  ])
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'signUp'
  )
  assert.equal(notifications.enqueueAccount.mock.calls[0].arguments[2], session)
  assert.deepEqual(verification.issue.mock.calls[0].arguments, [
    user,
    session,
    'ka'
  ])
})
test('duplicate signup never writes', async () => {
  users.existsByEmail.mock.mockImplementation(async () => true)
  await assert.rejects(() => a.signUp(credentials), { status: 409 })
  assert.equal(users.create.mock.callCount(), 0)
})
test('signup surfaces outbox failure instead of issuing JWT', async () => {
  notifications.enqueueAccount.mock.mockImplementation(async () => {
    throw Error('outbox unavailable')
  })
  await assert.rejects(() => a.signUp(credentials), /outbox unavailable/)
})
test('signin returns token only for existing matching credentials', async () => {
  assert.equal((await a.signIn(credentials)).accessToken, 'jwt')
  users.getCredentialsByEmail.mock.mockImplementation(async () => null)
  await assert.rejects(() => a.signIn(credentials), {
    messageKey: 'auth.invalid_credentials'
  })
  users.getCredentialsByEmail.mock.mockImplementation(async () => user)
  bcrypt.compare.mock.mockImplementation(async () => false)
  await assert.rejects(() => a.signIn(credentials), { status: 401 })
})
test('logout stores hashed token with positive remaining TTL only', async () => {
  await a.signOut({
    accessToken: 'secret',
    expiresAt: Math.floor(Date.now() / 1000) + 60
  })
  assert.equal(redis.set.mock.calls[0].arguments[0], 'expiredToken:digest')
  assert(redis.set.mock.calls[0].arguments[2].EX > 0)
  await a.signOut({ accessToken: 'expired', expiresAt: 1 })
  assert.equal(redis.set.mock.callCount(), 1)
})
test('unknown reset account and changed identity do not enqueue mail', async () => {
  users.getByEmail.mock.mockImplementation(async () => null)
  await a.resetPassword({ email: user.email })
  assert.equal(database.transaction.mock.callCount(), 0)
  users.getByEmail.mock.mockImplementation(async () => user)
  users.lock.mock.mockImplementation(async () => ({
    ...user,
    email: 'changed@example.test'
  }))
  await a.resetPassword({ email: user.email })
  assert.equal(tokens.createReset.mock.callCount(), 0)
})
test('reset request cancels previous pending jobs and stores link atomically', async () => {
  await a.resetPassword({ email: user.email }, 'ka')
  assert.equal(tokens.createReset.mock.calls[0].arguments[1], session)
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'resetPassword'
  )
})
test('new password consumes token and invalidates all prior links', async () => {
  tokens.consumeReset.mock.mockImplementation(async () => ({ userId: user.id }))
  await a.newPassword('token', { password: 'new' })
  assert.equal(tokens.deleteResets.mock.callCount(), 1)
  assert.equal(verification.invalidate.mock.callCount(), 1)
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'successfullyUpdatedPassword'
  )
})
test('missing reset token or deleted account fails closed', async () => {
  await assert.rejects(() => a.newPassword('bad', { password: 'new' }), {
    status: 403
  })
  tokens.consumeReset.mock.mockImplementation(async () => ({ userId: user.id }))
  users.updatePassword.mock.mockImplementation(async () => null)
  await assert.rejects(() => a.newPassword('bad', { password: 'new' }), {
    status: 403
  })
})
for (const state of ['missing', 'version', 'password'])
  test(`password confirmation rejects ${state}`, async () => {
    if (state === 'missing')
      users.getCredentialsById.mock.mockImplementation(async () => null)
    if (state === 'version')
      users.getCredentialsById.mock.mockImplementation(async () => ({
        ...user,
        authVersion: 2
      }))
    if (state === 'password')
      bcrypt.compare.mock.mockImplementation(async () => false)
    await assert.rejects(
      () => a.updatePassword(user, { oldPassword: 'x', newPassword: 'y' }),
      { messageKey: 'auth.password_confirmation_failed' }
    )
    assert.equal(users.updatePassword.mock.callCount(), 0)
  })
test('same email is a no-op after password confirmation', async () => {
  assert.deepEqual(await a.updateEmail(user, credentials), {
    email: user.email
  })
  assert.equal(database.transaction.mock.callCount(), 0)
})
test('email update checks uniqueness, resets verification and notifies old address', async () => {
  await a.updateEmail(user, { email: 'new@example.test', password: 'x' })
  assert.deepEqual(users.updateEmail.mock.calls[0].arguments, [
    user.id,
    'new@example.test',
    false,
    session
  ])
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[1].email,
    user.email
  )
  assert.equal(verification.issue.mock.callCount(), 1)
})
test('email taken and lost account update reject', async () => {
  users.existsByEmail.mock.mockImplementation(async () => true)
  await assert.rejects(
    () => a.updateEmail(user, { email: 'new@example.test', password: 'x' }),
    { status: 409 }
  )
  users.existsByEmail.mock.mockImplementation(async () => false)
  users.updateEmail.mock.mockImplementation(async () => null)
  await assert.rejects(
    () => a.updateEmail(user, { email: 'new@example.test', password: 'x' }),
    { status: 401 }
  )
})
test('password update locks account and invalidates links', async () => {
  await a.updatePassword(user, { oldPassword: 'x', newPassword: 'y' })
  assert.equal(users.lockCurrent.mock.callCount(), 1)
  assert.equal(verification.invalidate.mock.callCount(), 1)
  users.updatePassword.mock.mockImplementation(async () => null)
  await assert.rejects(
    () => a.updatePassword(user, { oldPassword: 'x', newPassword: 'y' }),
    { status: 401 }
  )
})
test('delete cleans owned images only after successful transaction', async () => {
  media.deleteOwned.mock.mockImplementation(async () => ['image'])
  await a.deleteProfile(user, { password: 'x' })
  assert.deepEqual(media.cleanupFiles.mock.calls[0].arguments, [['image']])
  assert.equal(users.delete.mock.callCount(), 1)
  assert.equal(
    notifications.enqueueAccount.mock.calls[0].arguments[0],
    'successfullyDeleted'
  )
  media.cleanupFiles.mock.resetCalls()
  notifications.enqueueAccount.mock.mockImplementation(async () => {
    throw Error('rollback')
  })
  await assert.rejects(
    () => a.deleteProfile(user, { password: 'x' }),
    /rollback/
  )
  assert.equal(media.cleanupFiles.mock.callCount(), 0)
})
