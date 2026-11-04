import { spawnSync } from 'node:child_process'
import { projectRoot } from './config.mjs'

export const runNode = (args, options = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options
  })
  if (result.error) throw result.error
  if (result.signal) {
    console.error(`Node process stopped by ${result.signal}`)
    return 1
  }
  return result.status ?? 1
}
