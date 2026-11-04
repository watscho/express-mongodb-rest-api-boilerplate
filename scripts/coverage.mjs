import { parseArgs } from 'node:util'
import { runCoverage } from './testing/coverage.mjs'

const { values } = parseArgs({
  options: { 'report-only': { type: 'boolean', default: false } }
})
process.exitCode = await runCoverage({ enforce: !values['report-only'] })
