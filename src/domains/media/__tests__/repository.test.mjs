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
    refId: 'owner',
    status: { $nin: ['uploading', 'deleting'] }
  })
  assert.equal(await r.existsOwned('image', 'owner', session), false)
  assert.deepEqual(m.Model.exists.mock.calls[0].arguments[0], {
    _id: 'image',
    owner: 'owner',
    status: { $nin: ['uploading', 'deleting'] }
  })
  await r.listOwned('owner', session)
  assert.deepEqual(m.Model.find.mock.calls[0].arguments[0], { owner: 'owner' })
  await r.attachAvatar('image', 'owner', session)
  assert.deepEqual(m.Model.updateOne.mock.calls[0].arguments[0], {
    _id: 'image',
    owner: 'owner',
    status: { $nin: ['uploading', 'deleting'] }
  })
  await r.detachAvatar('owner', session)
  assert.equal(m.Model.updateMany.mock.calls[0].arguments[0].owner, 'owner')
  await r.deleteOwned('owner', session)
  assert.deepEqual(m.Model.updateMany.mock.calls.at(-1).arguments, [
    { owner: 'owner' },
    { $set: { status: 'deleting' } },
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
test('quota usage counts every owned state and reserves bounded capacity', async () => {
  m.setResult([])
  assert.deepEqual(await r.usage('a'.repeat(24), session), {
    count: 0,
    bytes: 0
  })
  m.setResult([{ count: 2, bytes: 100 }])
  assert.deepEqual(await r.usage('a'.repeat(24), session), {
    count: 2,
    bytes: 100
  })
  await r.reserve('filename', 'owner', session)
  await r.reservation('filename', 'owner')
  assert.equal(m.Model.findOne.mock.calls[0].arguments[0].status, 'uploading')
  await r.finalize({ filename: 'filename', size: 10 }, 'owner', session)
  assert.equal(
    m.Model.findOneAndUpdate.mock.calls[0].arguments[0].status,
    'uploading'
  )
  await r.markFailed('filename', 'owner')
  assert.equal(
    m.Model.findOneAndUpdate.mock.calls[1].arguments[1].$set.status,
    'deleting'
  )
  await r.removeDeleted('image')
  assert.deepEqual(m.Model.deleteOne.mock.calls[0].arguments[0], {
    _id: 'image',
    status: 'deleting'
  })
  await r.cleanupCandidates(new Date(), 10)
  await r.claimCleanup('image', new Date())
  assert(
    m.Model.findOneAndUpdate.mock.calls[2].arguments[0].$or[2].refType
      .$exists === false
  )
  await r.hasFilename('filename')
})
