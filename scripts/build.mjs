import { execFileSync } from 'node:child_process'
import { cp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const output = new URL('dist/', root)

await rm(output, { recursive: true, force: true })
execFileSync(
  process.execPath,
  [fileURLToPath(new URL('node_modules/@typescript/native/bin/tsc', root))],
  { cwd: fileURLToPath(root), stdio: 'inherit' }
)
await cp(
  new URL('src/domains/notifications/templates/', root),
  new URL('domains/notifications/templates/', output),
  { recursive: true }
)
