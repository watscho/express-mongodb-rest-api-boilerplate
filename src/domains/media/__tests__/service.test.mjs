import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  replace,
  methods,
  reset,
  user,
  session,
  database,
  logger
} from '../../../__tests__/helpers.mjs'
const repo = methods([
  'create',
  'getAvatar',
  'existsOwned',
  'detachAvatar',
  'attachAvatar',
  'listOwned',
  'deleteOwned'
])
const users = methods(['lockCurrent'])
const image = methods(['validate', 'resize', 'deleteFile'])
replace('app/database/mongodb.js', { database })
replace('app/runtime/logger.js', { logger })
replace('domains/users/index.js', { userService: users })
replace('domains/media/repository.js', { mediaRepository: repo })
replace('domains/media/image.js', {
  Image: class {
    validate(...args) {
      return image.validate(...args)
    }
    resize(...args) {
      return image.resize(...args)
    }
    deleteFile(...args) {
      return image.deleteFile(...args)
    }
  }
})
const { mediaService: m } =
  await import('../../../../dist/domains/media/service.js')
const row = {
  _id: user.id,
  owner: user.id,
  mimetype: 'image/png',
  filename: 'unit',
  path: 'unit',
  size: 10,
  originalname: 'unit.png',
  encoding: '7bit',
  destination: '.'
}
beforeEach(() => {
  reset(repo, users, image, logger, database)
  image.resize.mock.mockImplementation(async () => 'conversions/unit.webp')
  repo.create.mock.mockImplementation(async () => row)
  repo.listOwned.mock.mockImplementation(async () => [row])
})
test('upload validates converts and saves owned media within transaction', async () => {
  const result = await m.upload(row, user)
  assert.equal(result.id, user.id)
  assert.equal(image.validate.mock.callCount(), 1)
  assert.equal(repo.create.mock.calls[0].arguments[1], user.id)
  assert.equal(repo.create.mock.calls[0].arguments[2], session)
})
for (const mode of ['validate', 'resize', 'save'])
  test(`failed upload cleans files after ${mode}`, async () => {
    const fn = mode === 'save' ? repo.create : image[mode]
    fn.mock.mockImplementation(async () => {
      throw Error('failure')
    })
    await assert.rejects(() => m.upload(row, user), /failure/)
    assert.equal(image.deleteFile.mock.callCount(), 1)
  })
test('cleanup error does not replace original upload failure', async () => {
  image.validate.mock.mockImplementation(async () => {
    throw Error('original')
  })
  image.deleteFile.mock.mockImplementation(async () => {
    throw Error('cleanup')
  })
  await assert.rejects(() => m.upload(row, user), /original/)
  assert.equal(logger.error.mock.callCount(), 1)
})
test('avatar is optional and derived from owned media', async () => {
  assert.equal(await m.avatarUrl(user.id), undefined)
  repo.getAvatar.mock.mockImplementation(async () => row)
  assert.match(await m.avatarUrl(user.id), /conversions\/unit.webp$/)
})
test('avatar rejects foreign images before detach', async () => {
  await assert.rejects(() => m.updateAvatar(user, { imageId: user.id }), {
    status: 404
  })
  assert.equal(repo.detachAvatar.mock.callCount(), 0)
  repo.existsOwned.mock.mockImplementation(async () => true)
  await m.updateAvatar(user, { imageId: user.id })
  assert.deepEqual(repo.attachAvatar.mock.calls[0].arguments, [
    user.id,
    user.id,
    session
  ])
})
test('deletion returns owned files and tolerates filesystem cleanup errors', async () => {
  const files = await m.deleteOwned(user.id, session)
  assert.equal(files[0].id, user.id)
  assert.equal(repo.deleteOwned.mock.callCount(), 1)
  image.deleteFile.mock.mockImplementation(async () => {
    throw Error('permission')
  })
  await m.cleanupFiles(files)
  assert.equal(logger.error.mock.callCount(), 1)
})
test('successful filesystem cleanup produces no error log', async () => {
  await m.cleanupFiles([row])
  assert.equal(logger.error.mock.callCount(), 0)
})
