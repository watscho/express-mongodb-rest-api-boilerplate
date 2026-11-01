import { loadEnvironment } from './env.ts'
import { queueEnvironmentSchema } from './schemas.ts'

export const queueEnv = loadEnvironment(queueEnvironmentSchema, [
  'MAIL_QUEUE_ENCRYPTION_KEY'
])
