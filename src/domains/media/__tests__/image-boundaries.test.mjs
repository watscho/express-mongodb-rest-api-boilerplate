import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
let failure = false
const pipeline = {
  timeout() {
    return pipeline
  },
  rotate() {
    return pipeline
  },
  resize() {
    return pipeline
  },
  webp() {
    return pipeline
  },
  toFile: async () => {}
}
mock.module('sharp', { exports: { default: () => pipeline } })
mock.module('node:fs/promises', {
  exports: {
    access: async () => {
      throw Object.assign(Error('missing'), { code: 'ENOENT' })
    },
    mkdir: async () => {},
    rename: async () => {},
    stat: async () => ({ size: 256 * 1024 + 1 }),
    rm: async () => {
      if (failure) throw Error('disk')
    }
  }
})
replace('domains/media/utils.js', { storagePath: path => '/unit/' + path })
const { Image } = await import('../../../../dist/domains/media/image.js')
test('oversized conversion is removed instead of published', async () =>
  assert.rejects(() => new Image({ filename: 'unit' }).resize(), {
    messageKey: 'media.conversion_too_large'
  }))
test('both paths are attempted and unlink failure remains retryable', async () => {
  failure = true
  await assert.rejects(
    () => new Image({ filename: 'unit' }).deleteFile(),
    /disk/
  )
})
