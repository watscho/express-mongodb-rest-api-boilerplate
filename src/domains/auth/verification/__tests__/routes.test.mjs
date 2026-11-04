import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFixture } from '../../../../__tests__/routes.mjs'
import { request } from '../../../../__tests__/http.mjs'
const f = await routeFixture()
const { createVerificationRouter } =
  await import('../../../../../dist/domains/auth/verification/routes.js')
const app = f.app(createVerificationRouter((_req, _res, next) => next()))
test('verification request forwards current account email and locale', async () => {
  const res = await request(app, '/user/verification/request', {
    method: 'POST',
    body: { email: 'unit@example.test' },
    headers: { authorization: 'Bearer unit', 'accept-language': 'ka' }
  })
  assert.equal(res.status, 200)
  assert.equal(f.verification.request.mock.calls[0].arguments[2], 'ka')
})
test('verification confirmation validates token and forwards locale', async () => {
  const token = 'a'.repeat(96)
  assert.equal(
    (
      await request(app, '/user/verification/' + token, {
        headers: { 'accept-language': 'ka' }
      })
    ).status,
    200
  )
  assert.deepEqual(f.verification.confirm.mock.calls[0].arguments, [
    token,
    'ka'
  ])
  assert.equal((await request(app, '/user/verification/bad')).status, 400)
})
