import { loadEnvironment } from './env.ts'
import { notificationEnvironmentSchema } from './schemas.ts'

export const notificationEnv = loadEnvironment(
  notificationEnvironmentSchema,
  []
)
