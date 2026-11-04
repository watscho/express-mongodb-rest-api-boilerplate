import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
mock.module('node:fs', {
  exports: { readFileSync: () => JSON.stringify({ name: 'invalid' }) }
})
const { createOpenApiDocument } =
  await import('../../../../../dist/app/http/documentation/document.js')
test('OpenAPI refuses incomplete package metadata', () =>
  assert.throws(
    () => createOpenApiDocument(),
    /Invalid public package metadata/
  ))
