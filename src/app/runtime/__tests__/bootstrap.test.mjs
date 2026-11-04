import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
const load = mock.fn(async () => {}),
  report = mock.fn()
replace('app/config/process.js', { loadProcessConfiguration: load })
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
const { bootstrap } = await import('../../../../dist/app/runtime/bootstrap.js')
for (const [component, role] of [
  ['api', 'api'],
  ['mail-worker', 'mail-worker'],
  ['db:indexes', 'database'],
  ['db:migrate:legacy', 'database']
])
  test(`bootstrap ${component} validates ${role} before loading clients`, async () => {
    const start = mock.fn(async () => {
      assert.equal(load.mock.calls.at(-1).arguments[0], role)
    })
    await bootstrap(component, start)
    assert.equal(start.mock.callCount(), 1)
  })
test('documentation export loads without API configuration', async () => {
  const count = load.mock.callCount()
  await bootstrap('docs:export', async () => {})
  assert.equal(load.mock.callCount(), count)
})
test('bootstrap reports loading error and exit status without leaking exception', async () => {
  const previous = process.exitCode
  try {
    await bootstrap('docs:export', async () => {
      throw Error('private')
    })
    assert.equal(process.exitCode, 1)
    assert.equal(report.mock.calls.at(-1).arguments[1].stage, 'module_loading')
  } finally {
    process.exitCode = previous
  }
})
