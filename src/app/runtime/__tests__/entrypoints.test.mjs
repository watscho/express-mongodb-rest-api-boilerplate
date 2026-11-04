import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
const roles = []
replace('app/runtime/bootstrap.js', {
  bootstrap: async (role, start) => {
    roles.push(role)
    await start()
  }
})
replace('app/runtime/server.js', {})
replace('app/runtime/mail/process.js', {})
test('API and worker entrypoints select correct bootstrap role', async () => {
  await import('../../../../dist/index.js')
  await import('../../../../dist/app/runtime/mail/worker.js')
  assert.deepEqual(roles, ['api', 'mail-worker'])
})
// Import both public delivery exports without starting a worker or SMTP connection.
replace('domains/notifications/delivery/worker.js', {
  startMailWorker: mock.fn()
})
replace('domains/notifications/mailer.js', { closeMailTransport: mock.fn() })
test('delivery public facade exposes process lifecycle controls', async () => {
  const api =
    await import('../../../../dist/domains/notifications/delivery/index.js')
  assert.equal(typeof api.startMailWorker, 'function')
  assert.equal(typeof api.closeMailTransport, 'function')
})
