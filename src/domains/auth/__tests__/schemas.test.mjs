import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as auth from '../../../../dist/domains/auth/schemas.js'

for (const password of ['short', 'x'.repeat(49), '🙂'.repeat(19)])
  test(`reject password boundary ${password.length}`, () =>
    assert.equal(auth.passwordSchema.safeParse(password).success, false))

test('password valid boundaries and byte limit', () => {
  for (const p of ['123456', 'x'.repeat(48), '🙂'.repeat(18)])
    assert(auth.passwordSchema.safeParse(p).success)
})

test('email tokens require exactly 96 hex characters', () => {
  assert(
    auth.tokenParamsSchema.safeParse({ accessToken: 'a'.repeat(96) }).success
  )
  for (const t of ['a'.repeat(95), 'z'.repeat(96), 'jwt.token.value'])
    assert(!auth.tokenParamsSchema.safeParse({ accessToken: t }).success)
})
