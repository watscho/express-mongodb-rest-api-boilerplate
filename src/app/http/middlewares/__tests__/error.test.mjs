import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import multer from 'multer'
import { replace, logger } from '../../../../__tests__/helpers.mjs'
import { AppError } from '../../../../../dist/app/http/errors.js'
replace('app/runtime/logger.js', { logger })
const { errorMiddleware } =
  await import('../../../../../dist/app/http/middlewares/error.js')
const { requestMiddleware } =
  await import('../../../../../dist/app/http/middlewares/request.js')
function response() {
  return {
    locals: {},
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v
    },
    status(n) {
      this.statusCode = n
      return this
    },
    json(p) {
      this.payload = p
    },
    destroy() {
      this.destroyed = true
    }
  }
}
for (const [error, status, key] of [
  [
    new AppError(401, 'auth.authentication_required'),
    401,
    'auth.authentication_required'
  ],
  [new multer.MulterError('LIMIT_FILE_SIZE'), 413, 'media.file_too_large'],
  [
    new multer.MulterError('LIMIT_UNEXPECTED_FILE'),
    400,
    'media.invalid_upload'
  ],
  [new mongoose.Error.ValidationError(), 400, 'http.status.400'],
  [
    new mongoose.Error.CastError('ObjectId', 'bad', '_id'),
    400,
    'http.status.400'
  ],
  [
    Object.assign(new Error('private'), { code: 11000 }),
    409,
    'http.status.409'
  ],
  [
    Object.assign(new Error('private'), { status: 415 }),
    415,
    'http.status.415'
  ],
  [new Error('secret@example.com token=private'), 500, 'http.status.500']
])
  test(`error mapping ${error.name} ${status}`, () => {
    const res = response()
    errorMiddleware(
      error,
      { method: 'POST', url: '/private/token' },
      res,
      () => {}
    )
    assert.equal(res.statusCode, status)
    assert.equal(res.payload.messageKey, key)
    assert.equal(res.headers['Cache-Control'], 'no-store')
    assert(!JSON.stringify(res.payload).includes('private'))
    if (status === 401) assert.equal(res.headers['WWW-Authenticate'], 'Bearer')
  })
test('error after headers destroys unfinished response without sending JSON', () => {
  const res = response()
  res.headersSent = true
  errorMiddleware(Error('private'), { method: 'GET' }, res, () => {})
  assert.equal(res.destroyed, true)
  assert.equal(res.payload, undefined)
})
test('request IDs are generated locally and logs use route patterns', () => {
  const res = response()
  let finish
  res.on = (_event, cb) => {
    finish = cb
  }
  let calls = 0
  requestMiddleware(
    {
      method: 'GET',
      url: '/user/verification/raw-secret',
      route: { path: '/user/verification/:accessToken' }
    },
    res,
    () => calls++
  )
  assert.match(res.headers['X-Request-Id'], /^[a-f0-9-]{36}$/)
  finish()
  assert.equal(calls, 1)
  const args = logger.info.mock.calls.at(-1).arguments
  assert.equal(args[1].route, '/user/verification/:accessToken')
  assert(!JSON.stringify(args).includes('raw-secret'))
})
test('errors after completed headers preserve finished response and use matched route', () => {
  const res = response()
  res.headersSent = true
  res.writableEnded = true
  errorMiddleware(
    Error('private'),
    { method: 'GET', route: { path: '/unit/:id' } },
    res,
    () => {}
  )
  assert.equal(res.destroyed, undefined)
})
test('internal errors report matched route while keeping response value-free', () => {
  const res = response()
  errorMiddleware(
    Error('private'),
    { method: 'GET', route: { path: '/unit/:id' } },
    res,
    () => {}
  )
  assert.equal(res.statusCode, 500)
})
test('security budget errors include Retry-After without changing the response envelope', () => {
  const res = response()
  errorMiddleware(
    new AppError(429, 'auth.account_rate_limited', undefined, 60),
    { method: 'POST' },
    res,
    () => {}
  )
  assert.equal(res.headers['Retry-After'], '60')
  assert.equal(res.payload.status, 429)
})
