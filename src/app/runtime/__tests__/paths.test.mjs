import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveWithinRoot } from '../../../../dist/app/runtime/paths.js'

for (const p of ['..', '../escape', '/etc/passwd', '.', 'nested/../../escape'])
  test(`reject storage traversal ${p}`, () =>
    assert.throws(() => resolveWithinRoot('/tmp/unit-root', p)))

test('storage permits nested file and similarly named directory inside root', () =>
  assert.equal(
    resolveWithinRoot('/tmp/unit-root', 'a/b'),
    '/' + 'tmp/unit-root/a/b'
  ))
