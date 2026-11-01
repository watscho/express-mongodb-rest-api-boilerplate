import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

export const resolveWithinRoot = (root: string, path: string): string => {
  const target = resolve(root, path)
  const suffix = relative(root, target)
  if (
    !suffix ||
    suffix === '..' ||
    suffix.startsWith(`..${sep}`) ||
    isAbsolute(suffix)
  ) {
    throw new Error('Path must stay inside the configured root')
  }
  return target
}
