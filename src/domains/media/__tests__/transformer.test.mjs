import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toStoredImageDto,
  toOwnedImageDto
} from '../../../../dist/domains/media/transformer.js'

test('uploaded image adapter ignores filesystem paths from input', () => {
  assert.throws(() => toStoredImageDto(), {
    messageKey: 'media.image_required'
  })
  assert.throws(() => toStoredImageDto({ mimetype: 'image/svg+xml' }), {
    messageKey: 'media.unsupported_image_format'
  })
  const file = {
    originalname: 'a.png',
    encoding: '7bit',
    mimetype: 'image/png',
    filename: 'safe',
    path: '/private/secret',
    destination: '/private',
    size: 10
  }
  const dto = toStoredImageDto(file)
  assert.equal(dto.path, 'safe')
  assert.equal(dto.destination, '.')
  assert.equal(toOwnedImageDto({ ...dto, _id: 123, owner: 456 }).owner, '456')
})
