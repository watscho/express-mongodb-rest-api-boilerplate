import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { nodeArguments } from '../../../../scripts/testing/config.mjs'
const fixture = fileURLToPath(
  new URL('./fixtures/process-probe.mjs', import.meta.url)
)
function probe(mode, role) {
  const result = spawnSync(
    process.execPath,
    [
      ...nodeArguments({
        coverageDirectory: process.env.APP_TEST_COVERAGE_DIR
      }),
      fixture,
      mode,
      role
    ],
    { encoding: 'utf8', timeout: 10000 }
  )
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}
for (const role of ['api', 'mail-worker', 'database', 'mail:queue'])
  test(`configuration role ${role} loads only its required profiles`, () =>
    assert.equal(probe('success', role).ok, true))
test('configuration aggregates all profile failures', () => {
  const result = probe('invalid', 'api')
  assert.equal(result.name, 'ConfigurationError')
  assert.equal(result.issues.length, 7)
})
test('unexpected import failures retain original exception', () => {
  const result = probe('unexpected', 'api')
  assert.equal(result.name, 'Error')
  assert.equal(result.message, 'unexpected')
})
