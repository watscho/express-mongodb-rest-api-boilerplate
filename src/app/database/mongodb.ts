import mongoose from 'mongoose'
import type { DatabaseConnectionOptionsDto } from '../config/dto.ts'
import type { ClientSession } from 'mongoose'
import { databaseEnv as env } from '../config/database.ts'

mongoose.set('bufferCommands', false)

export const database = {
  connect: (options: DatabaseConnectionOptionsDto = {}) =>
    mongoose.connect(env.MONGODB_URI, {
      autoIndex: options.autoIndex ?? env.MONGODB_AUTO_INDEX,
      autoCreate: options.autoIndex ?? env.MONGODB_AUTO_INDEX,
      writeConcern: { w: 'majority' },
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: env.MONGODB_CONNECT_TIMEOUT_MS,
      waitQueueTimeoutMS: env.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
      maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS
    }),
  disconnect: () => mongoose.disconnect(),
  transaction: <T>(
    operation: (session: ClientSession) => Promise<T>
  ): Promise<T> =>
    mongoose.connection.transaction(operation, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    })
}
