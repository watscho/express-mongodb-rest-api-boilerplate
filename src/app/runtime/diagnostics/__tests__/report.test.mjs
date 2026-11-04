import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { reportFailure } from '../../../../../dist/app/runtime/diagnostics/report.js'
test('bootstrap diagnostics write sanitized human and JSON stderr records', () => {
  let output = ''
  const write = mock.method(process.stderr, 'write', chunk => {
    output += chunk
    return true
  })
  const before = process.env.NODE_ENV
  try {
    delete process.env.NODE_ENV
    reportFailure(Error('private'), { component: 'unit', stage: 'load' })
    assert(output.includes('UNEXPECTED_ERROR'))
    assert(!output.includes('private'))
    output = ''
    process.env.NODE_ENV = 'production'
    reportFailure(Error('private'), { component: 'unit' })
    assert.equal(JSON.parse(output).code, 'UNEXPECTED_ERROR')
  } finally {
    write.mock.restore()
    process.env.NODE_ENV = before
  }
})
