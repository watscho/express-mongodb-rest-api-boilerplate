import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import * as s from '../../../../dist/app/config/schemas.js'
import { loadEnvironment } from '../../../../dist/app/config/env.js'
const api = { REDIS_URI: 'redis://localhost', JWT_SECRET: 'x'.repeat(32) }
test('API defaults and JWT duration units', () => {
  for (const [input, seconds] of [
    ['1000ms', 1],
    ['2s', 2],
    ['3m', 180],
    ['4h', 14400],
    ['1d', 86400],
    ['1w', 604800],
    ['1y', 31557600]
  ]) {
    assert.equal(
      s.apiEnvironmentSchema.parse({ ...api, JWT_EXPIRATION: input })
        .JWT_EXPIRATION,
      seconds
    )
  }
  assert.equal(s.apiEnvironmentSchema.parse(api).APP_PORT, 8000)
})
for (const value of ['1ms', '0s', '-1h', '24', 'bad', '1.5h'])
  test(`reject invalid JWT lifetime ${value}`, () =>
    assert.equal(
      s.apiEnvironmentSchema.safeParse({ ...api, JWT_EXPIRATION: value })
        .success,
      false
    ))
for (const [key, value] of [
  ['JWT_SECRET', 'short'],
  ['APP_PORT', '0'],
  ['APP_PORT', '65536'],
  ['APP_URL', 'ftp://example.com'],
  ['APP_URL', 'http://user:pass@example.com'],
  ['CLIENT_URL', 'https://example.com?q=1'],
  ['CLIENT_URL', 'http://example.com/#frag'],
  ['REDIS_URI', 'http://localhost'],
  ['BCRYPT_ROUNDS', '9'],
  ['DOCS_USERNAME', 'bad:name']
])
  test(`reject invalid ${key}: ${value}`, () =>
    assert.equal(
      s.apiEnvironmentSchema.safeParse({ ...api, [key]: value }).success,
      false
    ))
test('production Swagger requires paired credentials', () => {
  assert.equal(
    s.apiEnvironmentSchema.safeParse({
      ...api,
      NODE_ENV: 'production',
      DOCS_ENABLED: 'true'
    }).success,
    false
  )
  assert.equal(
    s.apiEnvironmentSchema.safeParse({
      ...api,
      NODE_ENV: 'production',
      DOCS_ENABLED: 'true',
      DOCS_USERNAME: 'docs',
      DOCS_PASSWORD: 'x'.repeat(32)
    }).success,
    true
  )
  assert.equal(
    s.apiEnvironmentSchema.safeParse({ ...api, DOCS_USERNAME: 'docs' }).success,
    false
  )
})
test('database pool bounds and URI', () => {
  assert.equal(
    s.databaseEnvironmentSchema.safeParse({
      MONGODB_URI: 'mongodb://localhost',
      MONGODB_MIN_POOL_SIZE: 21,
      MONGODB_MAX_POOL_SIZE: 20
    }).success,
    false
  )
  assert.equal(
    s.databaseEnvironmentSchema.safeParse({ MONGODB_URI: 'http://localhost' })
      .success,
    false
  )
  assert.equal(
    s.databaseEnvironmentSchema.parse({
      MONGODB_URI: 'mongodb+srv://example.com'
    }).MONGODB_AUTO_INDEX,
    false
  )
})
test('queue encryption key validates exact hexadecimal bytes', () => {
  for (const key of ['', 'z'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])
    assert.equal(
      s.queueEnvironmentSchema.safeParse({ MAIL_QUEUE_ENCRYPTION_KEY: key })
        .success,
      false
    )
})
test('delivery rejects inverted retry bounds and stale heartbeat threshold', () => {
  assert.equal(
    s.deliveryEnvironmentSchema.safeParse({
      MAIL_RETRY_BASE_DELAY_MS: 5000,
      MAIL_RETRY_MAX_DELAY_MS: 1000
    }).success,
    false
  )
  assert.equal(
    s.deliveryEnvironmentSchema.safeParse({
      MAIL_WORKER_HEARTBEAT_MS: 10000,
      MAIL_WORKER_STALE_MS: 20000
    }).success,
    false
  )
  assert.equal(s.deliveryEnvironmentSchema.safeParse({}).success, true)
})
test('SMTP authentication is paired', () => {
  assert.equal(
    s.mailEnvironmentSchema.safeParse({ MAIL_USER: 'u' }).success,
    false
  )
  assert.equal(
    s.mailEnvironmentSchema.safeParse({ MAIL_USER: 'u', MAIL_PASSWORD: 'p' })
      .success,
    true
  )
})
test('secret files, conflict, empty and missing file diagnostics never leak secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'api-unit-'))
  const key = 'UNIT_ONLY_SECRET'
  const file = join(dir, 'secret')
  const schema = z.object({ [key]: z.string().min(8) })
  try {
    writeFileSync(file, 'private-secret\n')
    process.env[key + '_FILE'] = file
    assert.equal(loadEnvironment(schema, [key])[key], 'private-secret')
    process.env[key] = 'other-secret'
    assert.throws(
      () => loadEnvironment(schema, [key]),
      e =>
        e.issues[0].code === 'secret_conflict' &&
        !JSON.stringify(e).includes('other-secret')
    )
    delete process.env[key]
    writeFileSync(file, '')
    assert.throws(
      () => loadEnvironment(schema, [key]),
      e => e.issues[0].code === 'secret_empty'
    )
    process.env[key + '_FILE'] = join(dir, 'missing')
    assert.throws(
      () => loadEnvironment(schema, [key]),
      e =>
        e.issues[0].code === 'secret_unreadable' &&
        !JSON.stringify(e).includes(dir)
    )
    delete process.env[key + '_FILE']
    assert.throws(
      () => loadEnvironment(schema),
      e => e.issues[0].code === 'required'
    )
    process.env[key] = 'short'
    assert.throws(
      () => loadEnvironment(schema),
      e => !JSON.stringify(e).includes('short')
    )
    process.env[key] = 'long-enough'
    assert(Object.isFrozen(loadEnvironment(schema)))
  } finally {
    delete process.env[key]
    delete process.env[key + '_FILE']
    rmSync(dir, { recursive: true, force: true })
  }
})
test('environment diagnostics cover invalid types enums formats and exclusive bounds safely', () => {
  const original = process.env.UNIT_VALUE
  process.env.UNIT_VALUE = 'configured-secret'
  const cases = [
    { code: 'invalid_type', expected: 'number' },
    { code: 'invalid_value', values: ['one', 'two'] },
    { code: 'invalid_format', format: 'regex' },
    { code: 'custom' },
    { code: 'invalid_union' },
    ...['too_small', 'too_big'].flatMap(code =>
      [true, false].flatMap(inclusive =>
        ['number', 'string'].map(origin => ({
          code,
          inclusive,
          origin,
          minimum: 3,
          maximum: 9
        }))
      )
    )
  ]
  try {
    for (const issue of cases) {
      assert.throws(
        () =>
          loadEnvironment({
            safeParse: () => ({
              success: false,
              error: { issues: [{ ...issue, path: ['UNIT_VALUE'] }] }
            })
          }),
        error => {
          assert(error.issues[0].reason.length > 0)
          assert(!JSON.stringify(error).includes('configured-secret'))
          return true
        }
      )
    }
    assert.throws(
      () =>
        loadEnvironment({
          safeParse: () => ({
            success: false,
            error: { issues: [{ code: 'custom', path: [] }] }
          })
        }),
      error => error.issues[0].field === 'environment'
    )
    const previous = process.env.MONGODB_URI
    delete process.env.MONGODB_URI
    try {
      assert.throws(
        () => loadEnvironment(s.databaseEnvironmentSchema),
        error => error.issues[0].reason.includes('mongodb://')
      )
    } finally {
      process.env.MONGODB_URI = previous
    }
  } finally {
    if (original === undefined) delete process.env.UNIT_VALUE
    else process.env.UNIT_VALUE = original
  }
})
test('invalid application URL and empty documentation credentials are handled', () => {
  assert(
    !s.apiEnvironmentSchema.safeParse({ ...api, APP_URL: 'not-a-url' }).success
  )
  assert(
    s.apiEnvironmentSchema.safeParse({
      ...api,
      DOCS_USERNAME: '',
      DOCS_PASSWORD: ''
    }).success
  )
})
