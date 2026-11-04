import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFixture } from '../../../__tests__/routes.mjs'
import { request } from '../../../__tests__/http.mjs'
const f = await routeFixture()
const { createRouter } = await import('../../../../dist/app/http/router.js')
const app = f.app(createRouter((_req, _res, next) => next()))
test('root router composes account media auth and template domain routes', async () => {
  assert.equal(
    (await request(app, '/me', { headers: { authorization: 'Bearer unit' } }))
      .status,
    200
  )
  assert.equal(
    (
      await request(app, '/auth/sign-in', {
        method: 'POST',
        body: { email: 'unit@example.test', password: 'secret' }
      })
    ).status,
    200
  )
  assert.equal(
    (
      await request(app, '/notifications/templates', {
        headers: { authorization: 'Bearer unit' }
      })
    ).status,
    200
  )
})
