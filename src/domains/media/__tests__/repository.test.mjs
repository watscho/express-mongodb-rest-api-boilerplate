import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { replace, modelDouble, session } from '../../../__tests__/helpers.mjs'
const m = modelDouble()
replace('domains/media/model.js', { Media: m.Model })
const { mediaRepository: r } =
  await import('../../../../dist/domains/media/repository.js')
beforeEach(() => m.reset())
test('all image lookups and mutations include owner scope', async () => {
  await r.getAvatar('owner')
  assert.deepEqual(m.Model.findOne.mock.calls[0].arguments[0], {
    owner: 'owner',
    refType: 'User',
    refId: 'owner'
  })
  assert.equal(await r.existsOwned('image', 'owner', session), false)
  assert.deepEqual(m.Model.exists.mock.calls[0].arguments[0], {
    _id: 'image',
    owner: 'owner'
  })
  await r.listOwned('owner', session)
  assert.deepEqual(m.Model.find.mock.calls[0].arguments[0], { owner: 'owner' })
  await r.attachAvatar('image', 'owner', session)
  assert.deepEqual(m.Model.updateOne.mock.calls[0].arguments[0], {
    _id: 'image',
    owner: 'owner'
  })
  await r.detachAvatar('owner', session)
  assert.equal(m.Model.updateMany.mock.calls[0].arguments[0].owner, 'owner')
  await r.deleteOwned('owner', session)
  assert.deepEqual(m.Model.deleteMany.mock.calls[0].arguments, [
    { owner: 'owner' },
    { session }
  ])
})
test('creation saves owner and session; exists returns boolean', async () => {
  m.setResult({ id: 'image' })
  assert.deepEqual(await r.create({ filename: 'unit' }, 'owner', session), {
    id: 'image'
  })
  assert.deepEqual(m.save.mock.calls[0].arguments, [{ session }])
  assert.equal(await r.existsOwned('image', 'owner', session), true)
})
