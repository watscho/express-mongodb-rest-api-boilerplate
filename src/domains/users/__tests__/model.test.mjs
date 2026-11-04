import { test } from 'node:test'
import assert from 'node:assert/strict'
import { User } from '../../../../dist/domains/users/model.js'
import { ResetPassword } from '../../../../dist/domains/auth/model.js'
import { Verification } from '../../../../dist/domains/auth/verification/model.js'
import { Media } from '../../../../dist/domains/media/model.js'
import {
  EmailOutbox,
  EmailWorker
} from '../../../../dist/domains/notifications/delivery/model.js'
import { verificationTokenSchema } from '../../../../dist/domains/auth/verification/schemas.js'
import { diagnosticSchema } from '../../../../dist/app/runtime/diagnostics/schemas.js'
test('user model validates hash/version fields and JSON excludes credentials', async () => {
  const user = new User({
    email: ' UNIT@EXAMPLE.TEST ',
    password: '$2b$10$' + 'a'.repeat(53)
  })
  await user.validate()
  assert.equal(user.email, 'unit@example.test')
  assert.equal(user.authVersion, 0)
  const json = user.toJSON()
  assert(!('password' in json))
  assert(!('authVersion' in json))
  user.authVersion = 1.5
  await assert.rejects(
    () => user.validate(),
    error => Boolean(error.errors.authVersion)
  )
})
test('token and media models reject invalid values and define operational indexes', async () => {
  for (const Model of [
    ResetPassword,
    Verification,
    Media,
    EmailOutbox,
    EmailWorker
  ]) {
    await assert.rejects(() => new Model().validate())
    assert(Model.schema.indexes().length > 0)
  }
  assert(verificationTokenSchema)
  assert(diagnosticSchema)
})
