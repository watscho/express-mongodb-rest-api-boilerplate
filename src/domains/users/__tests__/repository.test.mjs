import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  modelDouble,
  session,
  user
} from '../../../__tests__/helpers.mjs'
const m = modelDouble()
replace('domains/users/model.js', { User: m.Model })
const { userRepository: r } =
  await import('../../../../dist/domains/users/repository.js')
const row = { ...user, _id: user.id, password: 'hash' }
beforeEach(() => m.reset())
for (const method of [
  'getById',
  'getByEmail',
  'getCredentialsById',
  'getCredentialsByEmail',
  'lock',
  'updatePassword',
  'updateEmail'
])
  test(`${method} normalizes present record and handles absence`, async () => {
    const args =
      method === 'lock'
        ? [user.id, session, 1]
        : method === 'updatePassword'
          ? [user.id, 'hash', session]
          : method === 'updateEmail'
            ? [user.id, user.email, true, session]
            : [user.id]
    assert.equal(await r[method](...args), null)
    m.setResult(row)
    const result = await r[method](...args)
    assert.equal(result.id, user.id)
    assert.equal('password' in result, method.startsWith('getCredentials'))
  })
test('credential projection explicitly opts into password', async () => {
  await r.getCredentialsByEmail(user.email)
  assert(m.query.select.mock.calls[0].arguments[0].includes('+password'))
})
test('version lock filters stale account version', async () => {
  await r.lock(user.id, session, 7)
  assert.deepEqual(m.Model.findOneAndUpdate.mock.calls[0].arguments[0], {
    _id: user.id,
    authVersion: 7
  })
})
test('security mutations increment auth version', async () => {
  await r.updatePassword(user.id, 'hash', session)
  await r.updateEmail(user.id, user.email, false, session)
  for (const call of m.Model.findByIdAndUpdate.mock.calls) {
    assert.deepEqual(call.arguments[1].$inc, { authVersion: 1 })
    assert.equal(call.arguments[2].session, session)
  }
})
test('profile writes allow listed fields only', async () => {
  await r.updateProfile(
    user.id,
    { firstName: 'Unit', lastName: 'Test', admin: true },
    session
  )
  assert.deepEqual(m.Model.updateOne.mock.calls[0].arguments[1], {
    $set: { firstName: 'Unit', lastName: 'Test' }
  })
})
test('existence, creation and deletion preserve caller session', async () => {
  assert.equal(await r.existsByEmail(user.email), false)
  m.setResult(row)
  assert.equal(await r.existsByEmail(user.email, session), true)
  assert.equal(
    (await r.create({ email: user.email, password: 'hash' }, session)).id,
    user.id
  )
  assert.deepEqual(m.save.mock.calls[0].arguments, [{ session }])
  await r.delete(user.id, session)
  assert.deepEqual(m.Model.deleteOne.mock.calls[0].arguments, [
    { _id: user.id },
    { session }
  ])
})
test('lock without expected version supports reset flows', async () => {
  await r.lock(user.id, session)
  assert.deepEqual(m.Model.findOneAndUpdate.mock.calls[0].arguments[0], {
    _id: user.id
  })
})
