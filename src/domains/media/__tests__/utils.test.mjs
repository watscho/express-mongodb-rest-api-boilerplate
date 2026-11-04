import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  storageRoot,
  storagePath,
  storageUrl
} from '../../../../dist/domains/media/utils.js'
test('storage paths remain contained and public URL path segments are encoded', () => {
  assert.equal(storagePath('image'), storageRoot + '/image')
  assert.throws(() => storagePath('../escape'))
  assert.equal(
    storageUrl('folder\\a b.webp'),
    'http://localhost:8000/storage/public/folder/a%20b.webp'
  )
})
