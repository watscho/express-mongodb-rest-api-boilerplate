import { loadEnvironment } from './env.ts'
import { apiEnvironmentSchema } from './schemas.ts'

export const apiEnv = loadEnvironment(apiEnvironmentSchema, [
  'JWT_SECRET',
  'REDIS_URI',
  'DOCS_PASSWORD'
])
