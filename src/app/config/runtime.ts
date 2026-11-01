import { loadEnvironment } from './env.ts'
import { runtimeEnvironmentSchema } from './schemas.ts'

export const runtimeEnv = loadEnvironment(runtimeEnvironmentSchema, [])
