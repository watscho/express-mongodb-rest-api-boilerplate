import { test, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import coverageLibrary from 'istanbul-lib-coverage'
import { createInstrumenter } from 'istanbul-lib-instrument'
import {
  nodeArguments,
  testArguments,
  coverageMetrics,
  projectRoot
} from '../config.mjs'
import {
  hasFullCoverage,
  moduleFiles,
  validateInventory,
  coverageGaps
} from '../coverage.mjs'
import { runNode } from '../process.mjs'

const directory = await mkdtemp(join(tmpdir(), 'unit-tooling-'))
after(() => rm(directory, { recursive: true, force: true }))
const summary = () =>
  Object.fromEntries(
    coverageMetrics.map(metric => [
      metric,
      { total: 10, covered: 10, skipped: 0 }
    ])
  )

test('coverage gate accepts complete counters and rejects rounded percentages or skipped code', () => {
  assert.equal(hasFullCoverage(summary(), 1), true)
  for (const metric of coverageMetrics) {
    for (const replacement of [
      { total: 10000, covered: 9999, skipped: 0, pct: 100 },
      { total: 10, covered: 10, skipped: 1 },
      { total: 10, covered: 11, skipped: 0 },
      { total: NaN, covered: NaN, skipped: 0 },
      undefined
    ]) {
      assert.equal(
        Boolean(hasFullCoverage({ ...summary(), [metric]: replacement }, 1)),
        false
      )
    }
  }
  assert.equal(Boolean(hasFullCoverage(summary(), 0)), false)
  assert.equal(
    Boolean(
      hasFullCoverage(
        { ...summary(), statements: { total: 0, covered: 0, skipped: 0 } },
        1
      )
    ),
    false
  )
})

test('inventory includes nested modules and detects a source module omitted from the build', async () => {
  const source = join(directory, 'src'),
    dist = join(directory, 'dist')
  await mkdir(join(source, 'feature'), { recursive: true })
  await mkdir(join(dist, 'feature'), { recursive: true })
  await writeFile(join(source, 'feature', 'api.ts'), 'export const api = true')
  await writeFile(join(source, 'types.d.ts'), 'export type Unit = true')
  await writeFile(join(dist, 'feature', 'api.js'), 'export const api = true')
  await writeFile(join(dist, 'feature', 'api.js.map'), '{}')
  const files = await moduleFiles(dist)
  assert.deepEqual(files, [join(dist, 'feature', 'api.js')])
  assert.equal(await validateInventory(source, files, dist), 1)
  await writeFile(join(source, 'missing.ts'), 'export const missing = true')
  await assert.rejects(
    () => validateInventory(source, files, dist),
    /Missing compiled module for missing.ts/
  )
  const empty = join(directory, 'empty')
  await mkdir(empty)
  await assert.rejects(
    () => validateInventory(empty, [], dist),
    /No application source modules/
  )
})

test('unimported instrumented modules contribute zero counters and actionable gaps', () => {
  const instrumenter = createInstrumenter({ esModules: true })
  const file = join(projectRoot, 'dist', '__tooling_fixture__.js')
  instrumenter.instrumentSync(
    'export const unused = value => value ? 1 : 0;',
    file
  )
  const map = coverageLibrary.createCoverageMap({})
  map.addFileCoverage(instrumenter.lastFileCoverage())
  assert.equal(
    hasFullCoverage(map.getCoverageSummary().toJSON(), map.files().length),
    false
  )
  const gaps = coverageGaps(map)['dist/__tooling_fixture__.js']
  assert.deepEqual(gaps.statements, [1])
  assert.equal(gaps.functions.length, 1)
  assert.equal(gaps.branches.length, 2)
  const data = map.fileCoverageFor(file).data
  for (const key of Object.keys(data.s)) data.s[key] = 1
  for (const key of Object.keys(data.f)) data.f[key] = 1
  for (const key of Object.keys(data.b)) data.b[key] = data.b[key].map(() => 1)
  assert.deepEqual(coverageGaps(map), {})
})

test('test and probe launchers share explicit flags without copying parent worker options', () => {
  const ordinary = nodeArguments()
  const instrumented = nodeArguments({ coverageDirectory: directory })
  assert.equal(ordinary.filter(value => value === '--import').length, 1)
  assert.equal(instrumented.filter(value => value === '--import').length, 2)
  assert(!ordinary.includes('--test'))
  assert(testArguments().includes('--test-concurrency=4'))
  assert(testArguments().includes('--test-timeout=30000'))
})

test('Node command runner propagates unsuccessful exit status and startup errors', () => {
  assert.equal(runNode(['--eval', 'process.exit(7)'], { stdio: 'pipe' }), 7)
  assert.throws(
    () =>
      runNode(['--version'], {
        cwd: join(directory, 'missing'),
        stdio: 'pipe'
      }),
    { code: 'ENOENT' }
  )
})

test('Node command runner treats termination signals as failure', () => {
  const error = mock.method(console, 'error', () => {})
  try {
    assert.equal(
      runNode(['--eval', 'process.kill(process.pid, "SIGTERM")'], {
        stdio: 'pipe'
      }),
      1
    )
    assert(error.mock.calls[0].arguments[0].includes('SIGTERM'))
  } finally {
    error.mock.restore()
  }
})
