import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replace, methods, reset } from '../../../../__tests__/helpers.mjs'
const db = methods(['connect', 'disconnect'])
const ops = methods(['stats', 'list', 'show', 'retry', 'workers', 'healthy'])
const report = mock.fn()
let configurationFailure = false
const load = mock.fn(async () => {
  if (configurationFailure) throw Error('configuration')
})
replace('app/config/process.js', { loadProcessConfiguration: load })
replace('app/database/mongodb.js', { database: db })
replace('domains/notifications/delivery/operations.js', {
  deliveryOperations: ops
})
replace('app/runtime/diagnostics/report.js', { reportFailure: report })
let output, write, argv
beforeEach(() => {
  output = ''
  configurationFailure = false
  argv = process.argv
  process.exitCode = 0
  reset(db, ops, { report, load })
  write = mock.method(process.stdout, 'write', chunk => {
    output += chunk
    return true
  })
})
afterEach(() => {
  write.mock.restore()
  process.argv = argv
  process.exitCode = 0
})
let sequence = 0
async function run(file, args) {
  process.argv = ['node', 'unit', ...args]
  await import(
    `../../../../../dist/app/runtime/commands/${file}.js?case=${++sequence}`
  )
}
test('OpenAPI help and stdout export do not initialize services', async () => {
  await run('openapi', ['--help'])
  assert(output.includes('--output'))
  output = ''
  await run('openapi', ['--server', '/api'])
  assert.equal(JSON.parse(output).servers[0].url, '/api')
  assert.equal(db.connect.mock.callCount(), 0)
})
test('OpenAPI writes new output only and rejects invalid arguments', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unit-export-'))
  try {
    const path = join(dir, 'api.json')
    await run('openapi', ['--output', path])
    assert.equal(JSON.parse(await readFile(path, 'utf8')).openapi, '3.1.2')
    await run('openapi', ['--output', path])
    assert.equal(process.exitCode, 1)
    process.exitCode = 0
    await run('openapi', ['--server', '//evil'])
    assert.equal(process.exitCode, 1)
    assert.equal(
      report.mock.calls.at(-1).arguments[0].diagnostic.code,
      'CLI_ARGUMENTS_INVALID'
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test('queue help supports no args and explicit flag without database', async () => {
  await run('mail', [])
  assert(output.includes('Email queue'))
  await run('mail', ['--help'])
  assert.equal(db.connect.mock.callCount(), 0)
})
for (const args of [
  ['bad'],
  ['stats', 'extra'],
  ['list', '--limit', '0'],
  ['show', '--id', 'bad']
])
  test(`queue rejects ${args.join(' ')}`, async () => {
    await run('mail', args)
    assert.equal(process.exitCode, 1)
    assert.equal(db.connect.mock.callCount(), 0)
  })
for (const command of ['stats', 'list', 'show', 'retry', 'workers', 'health'])
  test(`queue ${command} emits result and disconnects`, async () => {
    if (command === 'health')
      ops.healthy.mock.mockImplementation(async () => true)
    else
      ops[
        command === 'show' ? 'show' : command === 'retry' ? 'retry' : command
      ].mock.mockImplementation(async () => ({ ok: true }))
    await run('mail', [
      command,
      ...(['show', 'retry'].includes(command) ? ['--id', 'a'.repeat(64)] : [])
    ])
    assert.equal(process.exitCode, 0)
    assert.equal(db.disconnect.mock.callCount(), 1)
    assert(JSON.parse(output))
  })
for (const command of ['show', 'retry', 'health'])
  test(`queue ${command} unavailable exits 2`, async () => {
    await run('mail', [
      command,
      ...(command === 'health' ? [] : ['--id', 'a'.repeat(64)])
    ])
    assert.equal(process.exitCode, 2)
  })
for (const mode of ['configuration', 'connect', 'command', 'disconnect'])
  test(`queue failure ${mode} reports safe stage`, async () => {
    if (mode === 'configuration') configurationFailure = true
    if (mode === 'connect')
      db.connect.mock.mockImplementation(async () => {
        throw Error('connect')
      })
    if (mode === 'command')
      ops.stats.mock.mockImplementation(async () => {
        throw Error('command')
      })
    if (mode === 'disconnect')
      db.disconnect.mock.mockImplementation(async () => {
        throw Error('disconnect')
      })
    await run('mail', ['stats'])
    assert.equal(process.exitCode, 1)
    assert(report.mock.callCount() > 0)
  })
