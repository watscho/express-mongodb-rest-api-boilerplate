import { loadEnvironment } from './env.ts'
import { mediaEnvironmentSchema } from './schemas.ts'

export const mediaEnv = loadEnvironment(mediaEnvironmentSchema)
