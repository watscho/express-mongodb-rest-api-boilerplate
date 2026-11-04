import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createOpenApiDocument } from '../../../../../dist/app/http/documentation/document.js'
import {
  jsonSchema,
  operation
} from '../../../../../dist/app/http/documentation/utils.js'
import { emailSchema } from '../../../../../dist/domains/users/schemas.js'
import { passwordSchema } from '../../../../../dist/domains/auth/schemas.js'
test('OpenAPI has unique operations and complete security/error contracts', () => {
  const doc = createOpenApiDocument('/api')
  assert.equal(doc.openapi, '3.1.2')
  assert.equal(
    doc.jsonSchemaDialect,
    'https://spec.openapis.org/oas/3.1/dialect/base'
  )
  assert.equal(doc.servers[0].url, '/api')
  assert.equal(Object.keys(doc.paths).length, 17)
  const ids = []
  for (const path of Object.values(doc.paths)) {
    for (const op of Object.values(path)) {
      if (!op.operationId) continue
      ids.push(op.operationId)
      assert(op.responses['200'])
      assert(Array.isArray(op.security))
    }
  }
  assert.equal(ids.length, 18)
  assert.equal(new Set(ids).size, 18)
})
test('JSON schemas annotate passwords and email without dialect helper fields', () => {
  const schema = jsonSchema(
    z.object({ email: emailSchema, password: passwordSchema })
  )
  assert.equal(schema.properties.email.format, 'email')
  assert.equal(schema.properties.password.writeOnly, true)
  assert(!('$schema' in schema))
  assert(!('~standard' in schema))
})
for (const [access, security] of [
  ['guest', []],
  ['authenticated', [{ bearerAuth: [] }]],
  ['public', [{}, { bearerAuth: [] }]]
])
  test(`operation ${access} security and parameters`, () => {
    const result = operation({
      operationId: 'unit',
      summary: 'Unit',
      description: 'Unit',
      tag: 'Unit',
      messageKey: 'auth.ok',
      access,
      emailLanguage: true,
      params: z.object({ id: z.string() }),
      body: z.object({ value: z.string() }),
      response: z.object({ ok: z.boolean() })
    })
    assert.deepEqual(result.security, security)
    assert(result.parameters.some(p => p.name === 'id' && p.required))
    assert(result.parameters.some(p => p.name === 'Accept-Language'))
    assert(result.requestBody.content['application/json'])
    assert(result.responses['429'].headers['Retry-After'])
    assert(result.responses['401'].headers['WWW-Authenticate'])
    if (access === 'guest') assert(result.responses['403'])
  })
test('export options reject relative unsafe and malformed server bases', async () => {
  const { openApiExportOptionsSchema } =
    await import('../../../../../dist/app/http/documentation/schemas.js')
  for (const server of [
    'relative',
    'ftp://host',
    '//host',
    '/api\r\nheader',
    'http://[invalid',
    'http://user:pass@host',
    '/api?q=1',
    '/api#frag'
  ])
    assert.equal(
      openApiExportOptionsSchema.safeParse({ server }).success,
      false,
      server
    )
})
test('custom documented error descriptions have a stable fallback', () => {
  const result = operation({
    operationId: 'custom',
    summary: 'Unit',
    description: 'Unit',
    tag: 'Unit',
    messageKey: 'auth.ok',
    access: 'public',
    errors: [418]
  })
  assert.equal(result.responses['418'].description, 'Request failed.')
})
