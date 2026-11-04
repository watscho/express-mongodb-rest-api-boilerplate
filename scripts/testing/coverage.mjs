import { createInstrumenter } from 'istanbul-lib-instrument'
import coverageLibrary from 'istanbul-lib-coverage'
import reportLibrary from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import { createHash } from 'node:crypto'
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  mkdtemp,
  rename,
  cp
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, dirname, sep } from 'node:path'
import { coverageMetrics, projectRoot, testArguments } from './config.mjs'
import { runNode } from './process.mjs'

const { createCoverageMap } = coverageLibrary
const { createContext } = reportLibrary

export const moduleFiles = async directory =>
  (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => join(entry.parentPath, entry.name))
    .sort()

export const validateInventory = async (source, compiledFiles, dist) => {
  const compiled = new Set(compiledFiles.map(file => relative(dist, file)))
  const sources = (
    await readdir(source, { recursive: true, withFileTypes: true })
  )
    .filter(
      entry =>
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts')
    )
    .map(entry => relative(source, join(entry.parentPath, entry.name)))
    .filter(file => !file.split(sep).includes('__tests__'))
  if (!sources.length) throw new Error('No application source modules found')
  for (const file of sources) {
    if (!compiled.has(file.replace(/\.ts$/, '.js'))) {
      throw new Error(
        `Missing compiled module for ${file}; run the build first`
      )
    }
  }
  return sources.length
}

export const hasFullCoverage = (summary, fileCount) =>
  fileCount > 0 &&
  summary.statements?.total > 0 &&
  coverageMetrics.every(metric => {
    const value = summary[metric]
    return (
      value &&
      Number.isSafeInteger(value.total) &&
      value.total >= 0 &&
      value.covered === value.total &&
      value.skipped === 0
    )
  })

export const coverageGaps = coverage => {
  const gaps = {}
  for (const file of coverage.files()) {
    const data = coverage.fileCoverageFor(file).toJSON()
    const missing = {
      statements: [
        ...new Set(
          Object.entries(data.s)
            .filter(([, count]) => !count)
            .map(([id]) => data.statementMap[id].start.line)
        )
      ],
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
      gaps[relative(projectRoot, file)] = missing
  }
  return gaps
}

export const runCoverage = async ({ enforce = true } = {}) => {
  const startedAt = new Date().toISOString()
  const dist = join(projectRoot, 'dist')
  const output = join(projectRoot, 'coverage')
  const files = await moduleFiles(dist)
  const sourceModuleCount = await validateInventory(
    join(projectRoot, 'src'),
    files,
    dist
  )
  const working = await mkdtemp(join(tmpdir(), 'express-api-coverage-'))
  try {
    await mkdir(join(working, 'raw'))
    const coverage = createCoverageMap({})
    const instrumenter = createInstrumenter({
      esModules: true,
      compact: false,
      coverageGlobalScope: 'globalThis',
      coverageGlobalScopeFunc: false
    })
    const modules = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      const instrumented = instrumenter.instrumentSync(source, file)
      coverage.addFileCoverage(instrumenter.lastFileCoverage())
      const destination = join(working, 'instrumented', relative(dist, file))
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, instrumented)
      modules.push({
        path: relative(projectRoot, file),
        sha256: createHash('sha256').update(source).digest('hex')
      })
    }
    const testExitCode = runNode(
      testArguments({ coverageDirectory: working }),
      { env: { ...process.env, APP_TEST_COVERAGE_DIR: working } }
    )
    const rawFiles = await readdir(join(working, 'raw'))
    for (const file of rawFiles)
      coverage.merge(
        JSON.parse(await readFile(join(working, 'raw', file), 'utf8'))
      )
    const reportDirectory = join(working, 'report')
    const context = createContext({
      dir: reportDirectory,
      coverageMap: coverage
    })
    for (const reporter of [
      'text-summary',
      'json-summary',
      'json',
      'html',
      'lcovonly'
    ])
      reports.create(reporter).execute(context)
    const summary = coverage.getCoverageSummary().toJSON()
    const complete = hasFullCoverage(summary, files.length)
    await writeFile(
      join(reportDirectory, 'gaps.json'),
      JSON.stringify(coverageGaps(coverage), null, 2) + '\n'
    )
    await writeFile(
      join(reportDirectory, 'manifest.json'),
      JSON.stringify(
        {
          startedAt,
          completedAt: new Date().toISOString(),
          nodeVersion: process.version,
          testExitCode,
          fullCoverage: complete,
          sourceModuleCount,
          instrumentedModuleCount: files.length,
          processReports: rawFiles.length,
          summary,
          modules
        },
        null,
        2
      ) + '\n'
    )
    // Preserve the previous report until a complete replacement has been generated.
    await rm(output, { recursive: true, force: true })
    // The temporary directory may be on another filesystem.
    try {
      await rename(reportDirectory, output)
    } catch (error) {
      if (error.code !== 'EXDEV') throw error
      await cp(reportDirectory, output, { recursive: true })
    }
    if (enforce && !complete)
      console.error(
        'Coverage must be 100% for statements, branches, functions, and lines. See coverage/gaps.json.'
      )
    return testExitCode || (enforce && !complete ? 1 : 0)
  } finally {
    await rm(working, { recursive: true, force: true })
  }
}
