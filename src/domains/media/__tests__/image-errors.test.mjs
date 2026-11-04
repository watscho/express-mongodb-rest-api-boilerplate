import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
let failure
mock.module('node:fs/promises', {
  exports: {
    access: async () => {
      throw failure
    },
    mkdir: async () => {},
    rename: async () => {},
    rm: async () => {}
  }
})
replace('domains/media/utils.js', { storagePath: path => '/unit/' + path })
const { Image } = await import('../../../../dist/domains/media/image.js')
test('conversion cache errors other than missing file propagate', async () => {
  for (const error of [
    Object.assign(Error('access denied'), { code: 'EACCES' }),
    'opaque'
  ]) {
    failure = error
    await assert.rejects(
      () => new Image({ filename: 'unit' }).resize(),
      e => e === error
    )
  }
})
