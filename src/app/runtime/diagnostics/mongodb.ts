import mongoose from 'mongoose'
import { logger } from '../logger.ts'
import { errorDiagnostic } from './diagnostic.ts'

// Install only in long-running processes, never in JSON-output administrative commands.
export const observeMongoDB = (component: string): (() => void) => {
  let connectedBefore = false
  let disconnected = false
  const connected = () => {
    if (connectedBefore && disconnected)
      logger.info('MongoDB connection restored', {
        component,
        stage: 'mongodb',
        code: 'MONGODB_RECONNECTED'
      })
    connectedBefore = true
    disconnected = false
  }
  const lost = () => {
    if (!connectedBefore || disconnected) return
    disconnected = true
    logger.warn('MongoDB disconnected', {
      component,
      stage: 'mongodb',
      code: 'MONGODB_DISCONNECTED',
      hint: 'Inspect MongoDB/network availability and API readiness; the driver may reconnect.'
    })
  }
  const failed = (error: unknown) => {
    if (connectedBefore)
      logger.error('MongoDB connection error', {
        component,
        stage: 'mongodb',
        ...errorDiagnostic(error, { component, stage: 'mongodb' })
      })
  }
  mongoose.connection
    .on('connected', connected)
    .on('disconnected', lost)
    .on('error', failed)
  return () => {
    mongoose.connection
      .off('connected', connected)
      .off('disconnected', lost)
      .off('error', failed)
  }
}
