import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import * as auth from '../../../../dist/domains/auth/schemas.js'
import * as users from '../../../../dist/domains/users/schemas.js'
import { toValidationIssueDto } from '../../../../dist/app/http/transformer.js'
import {
  respond,
  createErrorResponse
} from '../../../../dist/app/http/response.js'
import { validateRequest } from '../../../../dist/app/http/middlewares/schema.js'

test('validation errors expose constraints, never rejected values', () => {
  const r = z
    .object({ password: z.string().min(10) })
    .safeParse({ password: 'secret' })
  const dto = toValidationIssueDto(r.error.issues[0])
  assert.equal(dto.path, 'password')
  assert.equal(dto.params.min, 10)
  assert(!JSON.stringify(dto).includes('secret'))
  assert.deepEqual(
    toValidationIssueDto({
      code: 'custom',
      path: ['field', 0],
      message: 'auth.example',
      params: { max: 72, nested: { secret: true } }
    }),
    { path: 'field.0', messageKey: 'auth.example', params: { max: 72 } }
  )
  assert.equal(
    toValidationIssueDto({
      code: 'custom',
      path: [],
      message: 'English error text'
    }).messageKey,
    'validation.custom'
  )
})

test('response envelope preserves false/null data and omits undefined', () => {
  let status, payload
  const res = {
    status: n => {
      status = n
      return res
    },
    json: p => {
      payload = p
      return p
    }
  }
  respond(res, 'auth.ok', false, 201)
  assert.equal(status, 201)
  assert.equal(payload.data, false)
  respond(res, 'auth.ok')
  assert(!('data' in payload))
  assert.deepEqual(createErrorResponse(404), {
    status: 404,
    messageKey: 'http.status.404'
  })
})

test('request validation replaces parsed body and forwards once', () => {
  const req = { body: { email: ' X@EXAMPLE.COM ', extra: true } }
  let calls = 0
  validateRequest(z.object({ email: users.emailSchema }))(
    req,
    {},
    () => calls++
  )
  assert.deepEqual(req.body, { email: 'x@example.com' })
  assert.equal(calls, 1)
  assert.throws(
    () => validateRequest(auth.signUpSchema)({ body: {} }, {}, () => calls++),
    { status: 400, messageKey: 'validation.failed' }
  )
  assert.equal(calls, 1)
})
test('numeric and bigint bounds are serialized as safe validation parameters', () => {
  for (const [issue, field, value] of [
    [
      { code: 'too_small', minimum: 1n, inclusive: true, origin: 'bigint' },
      'min',
      '1'
    ],
    [
      { code: 'too_big', maximum: 9n, inclusive: false, origin: 'bigint' },
      'max',
      '9'
    ],
    [
      { code: 'too_big', maximum: 10, inclusive: true, origin: 'number' },
      'max',
      10
    ]
  ]) {
    assert.equal(
      toValidationIssueDto({ ...issue, path: ['amount'] }).params[field],
      value
    )
  }
})
