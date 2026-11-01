import { loadEnvironment } from './env.ts'
import { deliveryEnvironmentSchema } from './schemas.ts'

export const deliveryEnv = loadEnvironment(deliveryEnvironmentSchema, [])
