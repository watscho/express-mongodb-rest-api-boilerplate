import { resolve } from 'node:path'
import { apiEnv as env } from '../../app/config/api.ts'
import { projectRoot, resolveWithinRoot } from '../../app/runtime/paths.ts'

export const storageRoot = resolve(projectRoot, env.STORAGE_PATH)

export const storagePath = (path: string): string =>
  resolveWithinRoot(storageRoot, path)

export const storageUrl = (path: string): string =>
  `${env.APP_URL.replace(/\/$/, '')}${env.STORAGE_URL.replace(/\/$/, '')}/${path.split(/[\\/]/).map(encodeURIComponent).join('/')}`
