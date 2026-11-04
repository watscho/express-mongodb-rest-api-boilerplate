import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorDiagnostic } from '../../../../../dist/app/runtime/diagnostics/diagnostic.js'
import {
  sanitizeLogValue,
  formatConsole
} from '../../../../../dist/app/runtime/diagnostics/format.js'
for (const [code, expected] of [
  ['EADDRINUSE', 'HTTP_PORT_IN_USE'],
  ['EPERM', 'PERMISSION_DENIED'],
  ['ECONNREFUSED', 'REDIS_CONNECTION_REFUSED'],
  ['ENOTFOUND', 'REDIS_DNS_FAILED'],
  ['ETIMEDOUT', 'REDIS_TIMEOUT'],
  ['ECONNRESET', 'REDIS_CONNECTION_LOST'],
  ['CERT_HAS_EXPIRED', 'REDIS_TLS_FAILED'],
  ['ENOENT', 'FILE_NOT_FOUND'],
  ['EEXIST', 'OUTPUT_ALREADY_EXISTS'],
  ['MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'],
  ['ERR_INVALID_URL', 'CONNECTION_CONFIG_INVALID'],
  ['ERR_PARSE_ARGS_UNKNOWN_OPTION', 'CLI_ARGUMENTS_INVALID'],
  [11000, 'MONGODB_UNIQUE_CONFLICT']
])
  test(`safe diagnostic ${code}`, () => {
    const error = Object.assign(Error('sensitive-value'), { code })
    const dto = errorDiagnostic(error, { stage: 'redis' })
    assert.equal(dto.code, expected)
    assert(!JSON.stringify(dto).includes('sensitive-value'))
  })
test('nested causes and MongoDB authentication are recognized', () => {
  const error = new Error('sensitive', {
    cause: Object.assign(Error('secret'), { code: 18 })
  })
  assert.equal(
    errorDiagnostic(error, { stage: 'mongodb' }).code,
    'MONGODB_AUTH_FAILED'
  )
  assert.equal(
    errorDiagnostic(Object.assign(Error('secret'), { code: 13 }), {
      stage: 'mongodb'
    }).code,
    'MONGODB_PERMISSION_DENIED'
  )
})
test('unknown values and cyclic causes produce safe bounded diagnostics', () => {
  const error = Error('token=private')
  error.cause = error
  assert.equal(errorDiagnostic(error, {}).code, 'UNEXPECTED_ERROR')
  assert.equal(
    errorDiagnostic({ private: 'secret' }, {}).code,
    'UNEXPECTED_ERROR'
  )
})
test('log sanitizer redacts sensitive keys recursively and URL/bearer/email values', () => {
  const result = sanitizeLogValue({
    password: 'sensitive',
    nested: { JWT_SECRET: 'sensitive', payload: 'sensitive', count: 1 },
    reason:
      'redis://user:pass@host Bearer rawtoken user@example.com /user/verification/secret-token ?token=secret'
  })
  const text = JSON.stringify(result)
  for (const secret of [
    'sensitive',
    'user:pass',
    'rawtoken',
    'user@example.com',
    'secret-token',
    'token=secret'
  ])
    assert(!text.includes(secret))
  assert.equal(result.nested.count, 1)
})
test('sanitizer bounds cycles collections depth and unsafe types', () => {
  const value = {}
  value.self = value
  assert.equal(sanitizeLogValue(value).self, '[omitted]')
  assert.equal(sanitizeLogValue(Array(300).fill(1)).length, 200)
  assert.equal(sanitizeLogValue(1n), '1')
  assert.equal(sanitizeLogValue(new Date('invalid')), '[invalid date]')
  assert.equal(
    sanitizeLogValue(() => {}),
    '[unsupported]'
  )
  assert(
    !JSON.stringify(sanitizeLogValue(Error('private'))).includes('private')
  )
  assert.equal(sanitizeLogValue('x'.repeat(3000)).length, 2000)
})
test('console formatting includes safe diagnostic code and reason', () => {
  const output = formatConsole({
    timestamp: 'now',
    level: 'error',
    message: 'Failed',
    code: 'UNIT_FAILURE',
    reason: 'Test failure',
    hint: 'Retry'
  })
  assert(output.includes('UNIT_FAILURE'))
  assert(output.includes('Test failure'))
})
test('diagnostic formatting covers ordinary info contextual issues and stack records', () => {
  assert(
    formatConsole({
      timestamp: 'now',
      level: 'info',
      message: 'Started',
      component: 'api',
      count: 1
    }).includes('count')
  )
  assert(
    formatConsole({
      timestamp: 'now',
      level: 'info',
      message: 'Started'
    }).includes('INFO')
  )
  const text = formatConsole({
    timestamp: 'now',
    level: 'warn',
    message: 'Failure',
    context: { count: 1 },
    skip: undefined,
    reason: 'Reason',
    issues: [null, 'bad', {}, { field: 'A', reason: 'Required' }],
    stack: ['at src/unit.ts:1']
  })
  assert(text.includes('A: Required'))
  assert(text.includes('at src/unit.ts:1'))
  assert(
    !formatConsole({
      timestamp: 'now',
      level: 'warn',
      message: 'Failure'
    }).includes('Action:')
  )
  assert.equal(
    sanitizeLogValue(new Date('2026-01-01')),
    new Date('2026-01-01').toISOString()
  )
})
test('error diagnostics preserve authored errors and recognize dependency lifecycles', async () => {
  const { ConfigurationError } =
    await import('../../../../../dist/app/config/errors.js')
  const { DiagnosticError } =
    await import('../../../../../dist/app/runtime/diagnostics/errors.js')
  const { AppError } = await import('../../../../../dist/app/http/errors.js')
  const authored = new DiagnosticError({
    code: 'UNIT',
    reason: 'Safe',
    hint: 'Fix'
  })
  assert.equal(errorDiagnostic(authored, {}).code, 'UNIT')
  assert.equal(
    errorDiagnostic(new Error('wrapper', { cause: authored }), {}).code,
    'UNIT'
  )
  assert.equal(
    errorDiagnostic(new ConfigurationError([]), {}).code,
    'CONFIG_INVALID'
  )
  assert.equal(
    errorDiagnostic(
      new AppError(500, 'notifications.invalid_template_path'),
      {}
    ).code,
    'EMAIL_TEMPLATE_INVALID'
  )
  for (const [name, expected] of [
    ['MongoServerSelectionError', 'MONGODB_UNAVAILABLE'],
    ['ClientClosedError', 'DEPENDENCY_NOT_CONNECTED'],
    ['MongoParseError', 'CONNECTION_CONFIG_INVALID']
  ]) {
    const error = Error('private')
    error.name = name
    assert.equal(errorDiagnostic(error, {}).code, expected)
  }
  assert.equal(
    errorDiagnostic(
      Error('Transaction numbers are only allowed on a replica set'),
      {}
    ).code,
    'MONGODB_TRANSACTIONS_UNAVAILABLE'
  )
  assert.equal(
    errorDiagnostic(Error('WRONGPASS secret'), { stage: 'redis' }).code,
    'REDIS_AUTH_FAILED'
  )
  assert.equal(
    errorDiagnostic(Object.assign(Error('private'), { code: 'ECONNREFUSED' }), {
      stage: 'smtp'
    }).code,
    'SMTP_CONNECTION_REFUSED'
  )
  assert.equal(
    errorDiagnostic(
      Object.assign(Error('private'), { code: 'ECONNREFUSED' }),
      {}
    ).code,
    'DEPENDENCY_CONNECTION_REFUSED'
  )
  for (const error of [
    new TypeError('Cannot read properties of undefined (reading secret)'),
    new TypeError('x is not a function'),
    new TypeError('private'),
    new ReferenceError('private'),
    new SyntaxError('private')
  ])
    assert(!errorDiagnostic(error, {}).reason.includes('private'))
  const branch = {
    errors: [Error('inner')],
    servers: new Map([['unit', { cause: Error('inner') }]])
  }
  assert.equal(errorDiagnostic(branch, {}).code, 'UNEXPECTED_ERROR')
})
test('source stack diagnostics reject external and unsafe frames and cap frame count', () => {
  const root = new URL('../../../../../', import.meta.url).pathname
  const error = Error('private')
  error.stack = [
    'Error: private',
    '  at invalid',
    '  at file:///bad%ZZ:1:2',
    '  at /etc/passwd:1:2',
    `  at ${root}bad!name.ts:1:2`,
    `  at ${root}:1:2`,
    `  at ${root}src/unit.ts:1`,
    ...Array.from(
      { length: 45 },
      (_, i) =>
        `  at ${root}${i % 2 ? 'node_modules/lib' : 'src/app'}/unit.ts:${i + 1}:2`
    )
  ].join('\n')
  const dto = errorDiagnostic(error, {})
  assert(dto.stack.length <= 12)
  assert(
    dto.stack.every(
      frame => !frame.includes('passwd') && !frame.includes('bad!')
    )
  )
  assert(dto.stack.some(frame => frame.includes('src/unit.ts:1')))
  const missing = Error('private')
  missing.stack = undefined
  assert.deepEqual(errorDiagnostic(missing, {}).stack, [])
  const env = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    assert(!('stack' in errorDiagnostic(Error('private'), {})))
  } finally {
    process.env.NODE_ENV = env
  }
})
