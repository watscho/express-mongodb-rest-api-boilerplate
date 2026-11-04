import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routeFixture } from '../../../__tests__/routes.mjs'
import { request } from '../../../__tests__/http.mjs'
const f = await routeFixture()
const { createNotificationRouter } =
  await import('../../../../dist/domains/notifications/routes.js')
const app = f.app(createNotificationRouter())
test('authenticated catalog lists registered templates and guests are rejected', async () => {
  assert.equal((await request(app, '/notifications/templates')).status, 401)
  const res = await request(app, '/notifications/templates', {
    headers: { authorization: 'Bearer unit' }
  })
  assert.equal(res.status, 200)
  assert(res.body.data.templates.some(t => t.key === 'signUp'))
})
