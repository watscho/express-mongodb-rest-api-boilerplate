import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { routeFixture } from '../../../__tests__/routes.mjs'
import { request } from '../../../__tests__/http.mjs'
const f = await routeFixture()
const { createMediaRouter } =
  await import('../../../../dist/domains/media/routes.js')
const app = f.app(createMediaRouter())
const headers = { authorization: 'Bearer unit' }
function multipart(type) {
  return {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'multipart/form-data; boundary=unit'
    },
    body: Buffer.from(
      '--unit\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: ' +
        type +
        '\r\n\r\nunit-bytes\r\n--unit--\r\n'
    )
  }
}
test('multipart upload stores generated filename and passes ownership to media service', async () => {
  const res = await request(app, '/media/image/upload', multipart('image/png'))
  assert.equal(res.status, 200, res.text)
  const file = f.media.upload.mock.calls[0].arguments[0]
  assert.match(file.filename, /^[a-f0-9-]{36}$/)
  assert.equal(file.path, file.filename)
  assert.equal((await readdir(f.storageRoot)).length, 1)
})
test('upload rejects unsupported MIME and missing file', async () => {
  assert.equal(
    (await request(app, '/media/image/upload', multipart('image/svg+xml'))).body
      .messageKey,
    'media.unsupported_image_format'
  )
  assert.equal(
    (await request(app, '/media/image/upload', { method: 'POST', headers }))
      .body.messageKey,
    'media.image_required'
  )
})
test('avatar route validates owned image ID and invokes service', async () => {
  assert.equal(
    (
      await request(app, '/user/update/avatar', {
        method: 'POST',
        headers,
        body: { imageId: 'a'.repeat(24) }
      })
    ).status,
    200
  )
  assert.equal(f.media.updateAvatar.mock.callCount(), 1)
})
