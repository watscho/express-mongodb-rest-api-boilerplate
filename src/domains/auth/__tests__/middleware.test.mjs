import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { replace, methods, reset, user } from '../../../__tests__/helpers.mjs'
import { jwtSign } from '../../../../dist/domains/auth/utils.js'
const redis = methods(['exists'])
const users = methods(['getById'])
replace('app/database/redis.js', { redis })
replace('domains/users/index.js', { userService: users })
const { authMiddleware, authGuard, getAuth } =
  await import('../../../../dist/domains/auth/middleware.js')
beforeEach(() => {
  reset(redis, users)
  redis.exists.mock.mockImplementation(async () => 0)
  users.getById.mock.mockImplementation(async () => user)
})
const request = authorization => ({ headers: { authorization } })
test('anonymous auth skips lookups and continues', async () => {
  let n = 0
  await authMiddleware(request(), { locals: {} }, () => n++)
  assert.equal(n, 1)
  assert.equal(users.getById.mock.callCount(), 0)
})
for (const header of [
  'Basic abc',
  'Bearer',
  'Bearer two tokens',
  'Bearer invalid'
])
  test(`reject authorization ${header}`, async () =>
    assert.rejects(
      () => authMiddleware(request(header), { locals: {} }, () => {}),
      { status: 401 }
    ))
test('valid token attaches current account', async () => {
  const token = jwtSign(user).accessToken
  const res = { locals: {} }
  let n = 0
  await authMiddleware(request('Bearer ' + token), res, () => n++)
  assert.equal(n, 1)
  assert.equal(res.locals.auth.user, user)
  assert.equal(getAuth(res).accessToken, token)
})
for (const mode of ['revoked', 'deleted', 'version'])
  test(`reject ${mode} JWT`, async () => {
    if (mode === 'revoked') redis.exists.mock.mockImplementation(async () => 1)
    if (mode === 'deleted')
      users.getById.mock.mockImplementation(async () => null)
    if (mode === 'version')
      users.getById.mock.mockImplementation(async () => ({
        ...user,
        authVersion: 2
      }))
    await assert.rejects(
      () =>
        authMiddleware(
          request('Bearer ' + jwtSign(user).accessToken),
          { locals: {} },
          () => {}
        ),
      { status: 401 }
    )
  })
test('dependency failures propagate rather than becoming authentication success', async () => {
  redis.exists.mock.mockImplementation(async () => {
    throw Error('redis down')
  })
  await assert.rejects(
    () =>
      authMiddleware(
        request('Bearer ' + jwtSign(user).accessToken),
        { locals: {} },
        () => {}
      ),
    /redis down/
  )
})
test('guest and auth guards enforce presence of auth', () => {
  assert.throws(() => getAuth({ locals: {} }), { status: 401 })
  assert.throws(() => authGuard.isAuth({}, { locals: {} }, () => {}), {
    status: 401
  })
  assert.throws(
    () => authGuard.isGuest({}, { locals: { auth: {} } }, () => {}),
    { status: 403 }
  )
  let calls = 0
  authGuard.isAuth({}, { locals: { auth: {} } }, () => calls++)
  authGuard.isGuest({}, { locals: {} }, () => calls++)
  assert.equal(calls, 2)
})
