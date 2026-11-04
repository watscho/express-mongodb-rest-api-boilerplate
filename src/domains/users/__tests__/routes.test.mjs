import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFixture } from '../../../__tests__/routes.mjs'
import { request } from '../../../__tests__/http.mjs'
const f = await routeFixture()
const { createUserRouter } =
  await import('../../../../dist/domains/users/routes.js')
const app = f.app(createUserRouter())
const headers = { authorization: 'Bearer unit', 'accept-language': 'ka' }
test('profile response transforms current account and avatar', async () => {
  f.media.avatarUrl.mock.mockImplementation(
    async () => 'http://localhost/avatar.webp'
  )
  const res = await request(app, '/me', { headers })
  assert.equal(res.status, 200)
  assert.equal(res.body.data.image, 'http://localhost/avatar.webp')
  assert(!('authVersion' in res.body.data))
  assert.equal((await request(app, '/me')).status, 401)
})
test('profile mutation strips unknown keys and forwards language', async () => {
  const res = await request(app, '/user/update', {
    method: 'POST',
    headers,
    body: { firstName: ' Unit ', lastName: ' Test ', admin: true }
  })
  assert.equal(res.status, 200)
  assert.deepEqual(f.users.updateProfile.mock.calls[0].arguments[1], {
    firstName: 'Unit',
    lastName: 'Test'
  })
  assert.equal(f.users.updateProfile.mock.calls[0].arguments[2], 'ka')
})
