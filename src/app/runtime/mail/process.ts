import { deliveryEnv as env } from '../../config/delivery.ts'
import { database } from '../../database/mongodb.ts'
import { logger } from '../logger.ts'
import { errorDiagnostic } from '../diagnostics/diagnostic.ts'
import { observeMongoDB } from '../diagnostics/mongodb.ts'
import { reportFailure } from '../diagnostics/report.ts'
import { initializeMailTemplates } from '../../../domains/notifications/index.ts'
import {
  closeMailTransport,
  startMailWorker
} from '../../../domains/notifications/delivery/index.ts'

let worker: Awaited<ReturnType<typeof startMailWorker>> | undefined
let shutdownPromise: Promise<void> | undefined
const stopMongoObservation = observeMongoDB('mail-worker')

const closeResources = async () => {
  logger.info('Shutting down email worker')
  const timeout = setTimeout(() => {
    logger.error('Email worker shutdown deadline exceeded', {
      component: 'mail-worker',
      stage: 'shutdown',
      code: 'SHUTDOWN_TIMEOUT',
      hint: 'Inspect active deliveries and MongoDB shutdown; keep the supervisor grace period longer than MAIL_WORKER_SHUTDOWN_TIMEOUT_MS.'
    })
    process.exit(1)
  }, env.MAIL_WORKER_SHUTDOWN_TIMEOUT_MS)
  timeout.unref()
  try {
    await worker?.stop()
  } finally {
    closeMailTransport()
    stopMongoObservation()
    try {
      await database.disconnect()
    } finally {
      clearTimeout(timeout)
    }
  }
}

const shutdown = (exitCode = 0) => {
  if (exitCode) process.exitCode = exitCode
  shutdownPromise ??= closeResources()
  return shutdownPromise
}

const shutdownFailed = (error: unknown): never => {
  reportFailure(error, { component: 'mail-worker', stage: 'shutdown' })
  process.exit(1)
}

const fatal = (error: unknown) => {
  logger.error('Fatal email worker error', {
    component: 'mail-worker',
    stage: 'runtime',
    ...errorDiagnostic(error, { component: 'mail-worker', stage: 'runtime' })
  })
  void shutdown(1).catch(shutdownFailed)
}

let stage = 'email_templates'
try {
  await initializeMailTemplates()
  stage = 'mongodb'
  await database.connect()
  stage = 'worker'
  worker = await startMailWorker()
  process.once('SIGINT', () => {
    void shutdown().catch(shutdownFailed)
  })
  process.once('SIGTERM', () => {
    void shutdown().catch(shutdownFailed)
  })
  process.once('uncaughtException', fatal)
  process.once('unhandledRejection', fatal)
  logger.info('Email worker started', {
    workerId: worker.id,
    concurrency: env.MAIL_WORKER_CONCURRENCY
  })
} catch (error) {
  logger.error('Email worker startup failed', {
    component: 'mail-worker',
    stage,
    ...errorDiagnostic(error, { component: 'mail-worker', stage })
  })
  await shutdown(1).catch(shutdownFailed)
}
