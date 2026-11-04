import { registerHooks } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join, relative, isAbsolute, sep } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const dist = join(root, 'dist')
const working = process.env.APP_TEST_COVERAGE_DIR
if (!working || !isAbsolute(working))
  throw new Error('Coverage preload requires an absolute APP_TEST_COVERAGE_DIR')
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      const suffix = relative(dist, fileURLToPath(new URL(url)))
      if (
        suffix &&
        suffix !== '..' &&
        !suffix.startsWith(`..${sep}`) &&
        !isAbsolute(suffix) &&
        suffix.endsWith('.js')
      ) {
        return {
          format: 'module',
          source: readFileSync(join(working, 'instrumented', suffix), 'utf8'),
          shortCircuit: true
        }
      }
    }
    return nextLoad(url, context)
  }
})
process.on('exit', () => {
  if (globalThis.__coverage__)
    writeFileSync(
      join(working, 'raw', `${process.pid}-${randomUUID()}.json`),
      JSON.stringify(globalThis.__coverage__)
    )
})
