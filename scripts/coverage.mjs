import { createInstrumenter } from 'istanbul-lib-instrument'
import coverageLibrary from 'istanbul-lib-coverage'
const { createCoverageMap } = coverageLibrary
import reportLibrary from 'istanbul-lib-report'
const { createContext } = reportLibrary
import reports from 'istanbul-reports'
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, 'coverage')
await rm(output, { recursive: true, force: true })
await mkdir(join(output, 'raw'), { recursive: true })
const coverage = createCoverageMap({})
const instrumenter = createInstrumenter({
  esModules: true,
  compact: false,
  coverageGlobalScope: 'globalThis',
  coverageGlobalScopeFunc: false
})
for (const entry of await readdir(join(root, 'dist'), {
  recursive: true,
  withFileTypes: true
})) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue
  const file = join(entry.parentPath, entry.name)
  const source = await readFile(file, 'utf8')
  const instrumented = instrumenter.instrumentSync(source, file)
  coverage.addFileCoverage(instrumenter.lastFileCoverage())
  const destination = join(
    output,
    'instrumented',
    relative(join(root, 'dist'), file)
  )
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, instrumented)
}
const run = spawnSync(
  process.execPath,
  [
    '--experimental-test-module-mocks',
    '--import',
    './src/__tests__/setup.mjs',
    '--import',
    './scripts/coverage/preload.mjs',
    '--test',
    '--test-timeout=30000',
    'src/**/__tests__/*.test.mjs'
  ],
  { cwd: root, stdio: 'inherit' }
)
for (const file of await readdir(join(output, 'raw')))
  coverage.merge(JSON.parse(await readFile(join(output, 'raw', file), 'utf8')))
const context = createContext({ dir: output, coverageMap: coverage })
for (const reporter of ['text-summary', 'json-summary', 'json', 'html'])
  reports.create(reporter).execute(context)
const gaps = {}
for (const file of coverage.files()) {
  const item = coverage.fileCoverageFor(file)
  const data = item.toJSON()
  const missing = {
    statements: Object.entries(data.s)
      .filter(([, count]) => !count)
      .map(([id]) => data.statementMap[id].start.line),
    functions: Object.entries(data.f)
      .filter(([, count]) => !count)
      .map(([id]) => ({
        name: data.fnMap[id].name,
        line: data.fnMap[id].loc.start.line
      })),
    branches: Object.entries(data.b).flatMap(([id, counts]) =>
      counts.flatMap((count, index) =>
        count
          ? []
          : [
              {
                line: data.branchMap[id].line,
                type: data.branchMap[id].type,
                arm: index,
                location: data.branchMap[id].locations[index]
              }
            ]
      )
    )
  }
  if (Object.values(missing).some(value => value.length))
    gaps[relative(root, file)] = missing
}
await writeFile(join(output, 'gaps.json'), JSON.stringify(gaps, null, 2) + '\n')
const summary = coverage.getCoverageSummary().toJSON()
if (run.error) throw run.error
if (run.status !== 0) process.exitCode = run.status ?? 1
if (
  !process.argv.includes('--report-only') &&
  ['statements', 'branches', 'functions', 'lines'].some(
    key =>
      summary[key].covered !== summary[key].total || summary[key].skipped !== 0
  )
) {
  console.error(
    'Coverage must reach 100% for statements, branches, functions, and lines. See coverage/gaps.json and coverage/index.html.'
  )
  process.exitCode = 1
}
