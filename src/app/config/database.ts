import { loadEnvironment } from './env.ts'
import { databaseEnvironmentSchema } from './schemas.ts'

export const databaseEnv = loadEnvironment(databaseEnvironmentSchema, [
  'MONGODB_URI'
])
