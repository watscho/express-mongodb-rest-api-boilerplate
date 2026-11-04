import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { replace, methods, reset } from '../../../__tests__/helpers.mjs'
const repo = methods([
  'cleanupCandidates',
  'claimCleanup',
  'removeDeleted',
  'hasFilename'
])
const image = methods(['deleteFile'])
const remove = mock.fn(async () => {})
let entries, fsFailure, mtime, statFailure
mock.module('node:fs/promises', {
  exports: {
    opendir: async path => {
      if (fsFailure) throw fsFailure
      return (async function* () {
        yield* entries[path] ?? []
      })()
    },
    stat: async path => {
      if (statFailure) throw statFailure
      return { mtimeMs: mtime[path] ?? 0 }
    },
    rm: remove
  }
})
replace('domains/media/repository.js', { mediaRepository: repo })
replace('domains/media/image.js', {
  Image: class {
    deleteFile() {
      return image.deleteFile()
    }
  }
})
replace('domains/media/utils.js', {
  storageRoot: '/unit',
  storagePath: path => '/unit/' + path
})
const { cleanupUnusedMedia: cleanup } =
  await import('../../../../dist/domains/media/cleanup.js')
const id = 'a'.repeat(24)
const row = {
  _id: id,
  owner: id,
  filename: 'unit',
  path: 'unit',
  mimetype: 'image/png'
}
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const file = (name, isFile = true) => ({ name, isFile: () => isFile })
beforeEach(() => {
  reset(repo, image, { remove })
  entries = {}
  mtime = {}
  fsFailure = undefined
  statFailure = undefined
  repo.cleanupCandidates.mock.mockImplementation(async () => [])
})
for (const limit of [0, 1001, 1.5])
  test('cleanup rejects unsafe batch ' + limit, async () =>
    assert.rejects(() => cleanup(limit), /between 1 and 1000/)
  )
test('expired unattached records are claimed before unlink and lost claims are skipped', async () => {
  repo.cleanupCandidates.mock.mockImplementation(async () => [row, row])
  repo.claimCleanup.mock.mockImplementationOnce(async () => row)
  assert.deepEqual(await cleanup(), { deleted: 1, orphaned: 0, failed: 0 })
  assert.deepEqual(repo.removeDeleted.mock.calls[0].arguments, [id])
})
test('unlink failure keeps tombstone for a later cleanup', async () => {
  repo.cleanupCandidates.mock.mockImplementation(async () => [row])
  repo.claimCleanup.mock.mockImplementation(async () => row)
  image.deleteFile.mock.mockImplementation(async () => {
    throw Error('disk')
  })
  assert.equal((await cleanup()).failed, 1)
  assert.equal(repo.removeDeleted.mock.callCount(), 0)
})
test('orphan scan preserves live recent unknown and non-file entries and cleans deterministic conversions', async () => {
  entries['/unit'] = [
    file('directory', false),
    file('unknown'),
    file(uuid(1)),
    file(uuid(2)),
    file(uuid(3))
  ]
  entries['/unit/conversions'] = [file(uuid(4) + '_150x150.webp')]
  mtime['/unit/' + uuid(1)] = Date.now()
  repo.hasFilename.mock.mockImplementation(async name => name === uuid(2))
  const result = await cleanup()
  assert.equal(result.orphaned, 2)
  assert.equal(remove.mock.callCount(), 2)
})
test('orphan batch bound stops both directory scans', async () => {
  entries['/unit'] = [file(uuid(1)), file(uuid(2))]
  entries['/unit/conversions'] = [file(uuid(3) + '.tmp')]
  assert.equal((await cleanup(1)).orphaned, 1)
  assert.equal(remove.mock.callCount(), 1)
})
test('orphan errors are counted and files remain eligible for retries', async () => {
  entries['/unit'] = [file(uuid(1))]
  remove.mock.mockImplementation(async () => {
    throw Error('disk')
  })
  assert.equal((await cleanup()).failed, 1)
})
test('missing storage is tolerated but permission and opaque errors are reported', async () => {
  fsFailure = Object.assign(Error('missing'), { code: 'ENOENT' })
  assert.equal((await cleanup()).failed, 0)
  for (const error of [
    Object.assign(Error('denied'), { code: 'EACCES' }),
    Error('unknown'),
    'opaque'
  ]) {
    fsFailure = error
    await assert.rejects(
      () => cleanup(),
      e => e === error
    )
  }
})
