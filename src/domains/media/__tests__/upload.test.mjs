import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { replace, methods, user } from '../../../__tests__/helpers.mjs'
const media = methods(['reserveUpload', 'abandonUpload'])
media.reserveUpload.mock.mockImplementation(async () => 'unit')
replace('domains/auth/index.js', { getAuth: () => ({ user }) })
replace('domains/media/service.js', { mediaService: media })
replace('domains/media/utils.js', { storageRoot: '/unit' })
let receive, settings, timer, diskSettings, finishWrite
const remove = mock.fn((_request, _file, callback) => callback())
beforeEach(() => media.abandonUpload.mock.resetCalls())
const multer = options => {
  settings = options
  return { single: () => receive }
}
multer.diskStorage = input => {
  diskSettings = input
  return {
    _handleFile: (_req, _file, callback) => {
      finishWrite = callback
    },
    _removeFile: remove
  }
}
mock.module('multer', { exports: { default: multer } })
const { uploadSingleImage: upload } =
  await import('../../../../dist/domains/media/upload.js')
test('upload deadline destroys the request and releases its reservation after the writer callback', async () => {
  let nextError
  const destroy = mock.fn()
  const timeout = mock.method(globalThis, 'setTimeout', fn => {
    timer = fn
    return { unref() {} }
  })
  const clear = mock.method(globalThis, 'clearTimeout', () => {})
  receive = (req, _res, done) => {
    timer()
    req.destroyed = true
    req.file = { filename: 'unit' }
    done()
  }
  try {
    await upload({ destroy, complete: false, destroyed: false }, {}, error => {
      nextError = error
    })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(destroy.mock.callCount(), 1)
    assert.equal(media.abandonUpload.mock.callCount(), 1)
    assert.equal(nextError.status, 400)
    diskSettings.destination({}, {}, (error, path) => {
      assert.equal(error, null)
      assert.equal(path, '/unit')
    })
    diskSettings.filename({}, {}, (error, name) => {
      assert.equal(error, null)
      assert.equal(name, 'unit')
    })
  } finally {
    timeout.mock.restore()
    clear.mock.restore()
  }
})

test('aborted upload waits for pending disk writes before releasing quota', async () => {
  let nextError
  receive = (req, _res, done) => {
    settings.storage._handleFile(req, {}, () => {})
    done(new Error('aborted'))
  }
  await upload({ destroyed: false, complete: false }, {}, error => {
    nextError = error
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(media.abandonUpload.mock.callCount(), 0)
  finishWrite(null, {})
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(media.abandonUpload.mock.callCount(), 1)
  assert.equal(nextError.message, 'aborted')
  settings.storage._removeFile({}, {}, () => {})
  assert.equal(remove.mock.callCount(), 1)
})
test('request closed during reservation releases capacity without opening a writer', async () => {
  let error
  await upload({ destroyed: true, complete: false }, {}, value => {
    error = value
  })
  assert.equal(media.abandonUpload.mock.callCount(), 1)
  assert.equal(error.status, 400)
})
