import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace, methods, session, user } from '../../../__tests__/helpers.mjs'
const enqueueTemplate = mock.fn(async () => ({ id: 'job', status: 'queued' }))
const repo = methods(['getDelivery', 'retryFailed', 'cancelPending'])
replace('domains/notifications/delivery/service.js', { enqueueTemplate })
replace('domains/notifications/delivery/repository.js', {
  deliveryRepository: repo
})
replace('domains/notifications/renderer.js', { renderNotification: mock.fn() })
const { notificationService: n } =
  await import('../../../../dist/domains/notifications/service.js')
for (const [template, purpose] of [
  ['signUp', 'account'],
  ['resetPassword', 'resetPassword'],
  ['verification', 'verification']
])
  test(`${template} account notification has correct purpose session and token`, async () => {
    await n.enqueueAccount(
      template,
      {
        email: user.email,
        ownerId: user.id,
        accessToken: 'token',
        language: 'ka'
      },
      session
    )
    const [input, ctx] = enqueueTemplate.mock.calls.at(-1).arguments
    assert.equal(ctx.session, session)
    assert.equal(ctx.options.purpose, purpose)
    assert.equal(input.variables.accessToken, 'token')
    assert.equal(ctx.options.ownerId, user.id)
  })
test('notifications without action omit token variable', async () => {
  await n.enqueueAccount(
    'signUp',
    { email: user.email, ownerId: user.id },
    session
  )
  assert.deepEqual(enqueueTemplate.mock.calls.at(-1).arguments[0].variables, {})
})
