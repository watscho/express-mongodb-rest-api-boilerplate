import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFixture } from '../../../__tests__/routes.mjs'
import { request } from '../../../__tests__/http.mjs'
const f = await routeFixture()
const { createAuthRouter } =
  await import('../../../../dist/domains/auth/routes.js')
let limit = 0
const app = f.app(
  createAuthRouter((_req, _res, next) => {
    limit++
    next()
  })
)
const email = 'unit@example.test',
  password = 'secret123'
const token = 'a'.repeat(96)
for (const [path, body, method, service] of [
  ['/auth/sign-in', { email, password }, 'POST', 'signIn'],
  ['/auth/sign-up', { email, password }, 'POST', 'signUp'],
  ['/auth/sign-out', undefined, 'POST', 'signOut'],
  ['/auth/sign-out', undefined, 'GET', 'signOut'],
  ['/auth/password/reset', { email }, 'POST', 'resetPassword'],
  ['/auth/password/new/' + token, { password }, 'POST', 'newPassword'],
  ['/user/update/email', { email, password }, 'POST', 'updateEmail'],
  [
    '/user/update/password',
    { oldPassword: password, newPassword: 'updated123' },
    'POST',
    'updatePassword'
  ],
  ['/user/delete', { password }, 'POST', 'deleteProfile']
])
  test(`${method} ${path.slice(0, 40)} invokes account service`, async () => {
    const protectedRoute =
      path.startsWith('/user/') || path === '/auth/sign-out'
    const res = await request(app, path, {
      method,
      body,
      headers: {
        ...(protectedRoute ? { authorization: 'Bearer unit' } : {}),
        'accept-language': 'ka'
      }
    })
    assert.equal(res.status, 200, res.text)
    assert.equal(
      f.auth[service].mock.callCount(),
      service === 'signOut' ? (method === 'POST' ? 1 : 2) : 1
    )
    if (
      [
        'signUp',
        'resetPassword',
        'newPassword',
        'updateEmail',
        'updatePassword',
        'deleteProfile'
      ].includes(service)
    )
      assert.equal(f.auth[service].mock.calls.at(-1).arguments.at(-1), 'ka')
  })
test('route schemas reject malformed body before service and guest/protected policies apply', async () => {
  assert.equal(
    (
      await request(app, '/auth/sign-up', {
        method: 'POST',
        body: { email: 'bad' }
      })
    ).status,
    400
  )
  assert.equal(
    (
      await request(app, '/auth/sign-in', {
        method: 'POST',
        body: { email, password },
        headers: { authorization: 'Bearer unit' }
      })
    ).status,
    403
  )
  assert.equal(
    (await request(app, '/user/delete', { method: 'POST', body: { password } }))
      .status,
    401
  )
  assert(limit > 0)
})
