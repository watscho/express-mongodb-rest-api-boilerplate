import { parseArgs } from 'node:util'
import { testArguments } from './testing/config.mjs'
import { runNode } from './testing/process.mjs'

const { values } = parseArgs({
  options: {
    coverage: { type: 'boolean', default: false },
    'report-only': { type: 'boolean', default: false }
  }
})
if (values['report-only'] && !values.coverage)
  throw new Error('--report-only requires --coverage')
process.exitCode = runNode(['scripts/build.mjs'])
if (!process.exitCode) {
  if (values.coverage) {
    const { runCoverage } = await import('./testing/coverage.mjs')
    process.exitCode = await runCoverage({ enforce: !values['report-only'] })
  } else process.exitCode = runNode(testArguments())
}
