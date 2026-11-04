import { fileURLToPath } from 'node:url'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const coverageMetrics = ['statements', 'branches', 'functions', 'lines']
export const testPatterns = [
  'src/**/__tests__/*.test.mjs',
  'scripts/testing/__tests__/*.test.mjs'
]

// Explicit arguments keep child probes independent of Node's internal test-worker flags.
export const nodeArguments = ({ coverageDirectory } = {}) => [
  '--experimental-test-module-mocks',
  '--import',
  fileURLToPath(new URL('../../src/__tests__/setup.mjs', import.meta.url)),
  ...(coverageDirectory
    ? ['--import', fileURLToPath(new URL('./preload.mjs', import.meta.url))]
    : [])
]

export const testArguments = options => [
  ...nodeArguments(options),
  '--test',
  '--test-timeout=30000',
  '--test-concurrency=4',
  ...testPatterns
]
