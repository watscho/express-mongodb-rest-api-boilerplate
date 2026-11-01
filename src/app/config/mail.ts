import { loadEnvironment } from './env.ts'
import { mailEnvironmentSchema } from './schemas.ts'

export const mailEnv = loadEnvironment(mailEnvironmentSchema, [
  'MAIL_USER',
  'MAIL_PASSWORD'
])
