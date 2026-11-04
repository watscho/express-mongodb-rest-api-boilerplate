import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as auth from '../../../../dist/domains/auth/schemas.js'

for (const password of ['short', 'x'.repeat(49), '🙂'.repeat(19)])
  test(`reject password boundary ${password.length}`, () =>
    assert.equal(auth.passwordSchema.safeParse(password).success, false))

test('password valid boundaries and byte limit', () => {
  for (const p of ['juniper orbit velvet canoe', 'mQr7!bN2#zT8@kL4'.repeat(4)])
    assert(auth.passwordSchema.safeParse(p).success)
})

test('email tokens require exactly 96 hex characters', () => {
  assert(
    auth.tokenParamsSchema.safeParse({ accessToken: 'a'.repeat(96) }).success
  )
  for (const t of ['a'.repeat(95), 'z'.repeat(96), 'jwt.token.value'])
    assert(!auth.tokenParamsSchema.safeParse({ accessToken: t }).success)
})
test('new-password policy rejects common passwords and counts Unicode characters while preserving existing credentials', () => {
  for (const password of [
    '123456',
    'passwordpassword',
    'Password Password',
    'x'.repeat(20),
    '🙂'.repeat(8),
    'a'.repeat(73)
  ])
    assert.equal(
      auth.passwordSchema.safeParse(password).success,
      false,
      password
    )
  for (const password of [
    'az7!vN3@qL9#tR2',
    'mQr7!bN2#zT8@kL4'.repeat(4) + 'zero1234',
    '😀😁😂😃😄😅😆😉😊😋😎😍😘🥰🤩'
  ])
    assert.equal(
      auth.passwordSchema.safeParse(password).success,
      true,
      password
    )
  assert.equal(
    auth.credentialsSchema.parse({
      email: 'unit@example.test',
      password: '123456'
    }).password,
    '123456'
  )
  assert.equal(
    auth.updatePasswordSchema.safeParse({
      oldPassword: '123456',
      newPassword: 'juniper orbit velvet canoe'
    }).success,
    true
  )
})
test('password policy permits varied symbols and rejects repeated symbols', () => {
  assert.equal(auth.passwordSchema.safeParse('!@#$%^&*()+=~:;?').success, true)
  assert.equal(auth.passwordSchema.safeParse('!'.repeat(20)).success, false)
  assert.equal(
    auth.passwordSchema.safeParse('x-x-x-x-x-x-x-x-x').success,
    false
  )
})
