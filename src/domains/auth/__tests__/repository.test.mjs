import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  modelDouble,
  session,
  user
} from '../../../__tests__/helpers.mjs'
import { hashToken } from '../../../../dist/domains/auth/utils.js'
const m = modelDouble()
replace('domains/auth/model.js', { ResetPassword: m.Model })
const { tokenRepository: r } =
  await import('../../../../dist/domains/auth/repository.js')
beforeEach(() => m.reset())
test('reset persistence hashes raw token and uses upsert session', async () => {
  await r.createReset(
    { userId: user.id, accessToken: 'raw-secret', expiresIn: new Date() },
    session
  )
  const [filter, update, opts] =
    m.Model.findOneAndUpdate.mock.calls[0].arguments
  assert.deepEqual(filter, { user: user.id })
  assert.equal(update.$set.tokenHash, hashToken('raw-secret'))
  assert(!JSON.stringify(update).includes('raw-secret'))
  assert.equal(opts.session, session)
})
test('consume reset is atomic single-use with strict expiry predicate', async () => {
  assert.equal(await r.consumeReset('raw', session), null)
  const filter = m.Model.findOneAndDelete.mock.calls[0].arguments[0]
  assert.equal(filter.tokenHash, hashToken('raw'))
  assert(filter.expiresIn.$gt instanceof Date)
  m.setResult({ user: user.id, expiresIn: new Date() })
  assert.equal((await r.consumeReset('raw', session)).userId, user.id)
})
test('reset cleanup scoped to user and session', async () => {
  await r.deleteResets(user.id, session)
  assert.deepEqual(m.Model.deleteMany.mock.calls[0].arguments, [
    { user: user.id },
    { session }
  ])
})
