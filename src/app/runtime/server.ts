import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import { createApp } from '../http/app.ts'
import { apiEnv as env } from '../config/api.ts'
import { database } from '../database/mongodb.ts'
import { redis } from '../database/redis.ts'
import { logger } from './logger.ts'
import { errorDiagnostic } from './diagnostics/diagnostic.ts'
import { observeMongoDB } from './diagnostics/mongodb.ts'
import { reportFailure } from './diagnostics/report.ts'
import { storageRoot } from '../../domains/media/index.ts'

const server = createServer()
server.requestTimeout = 30000
server.headersTimeout = 15000
server.keepAliveTimeout = 5000
let shutdownPromise: Promise<void> | undefined
const stopMongoObservation = observeMongoDB('api')

const shutdown = (exitCode = 0): Promise<void> => {
  if (exitCode) process.exitCode = exitCode
  shutdownPromise ??= closeResources()
  return shutdownPromise
}

const shutdownFailed = (error: unknown): never => {
  reportFailure(error, { component: 'api', stage: 'shutdown' })
  process.exit(1)
}

const closeResources = async () => {
  logger.info('Shutting down API')
  const timeout = setTimeout(() => {
    logger.error('Shutdown deadline exceeded', {
      component: 'api',
      stage: 'shutdown',
      code: 'SHUTDOWN_TIMEOUT',
      hint: 'Inspect active requests and dependency shutdown; keep the supervisor grace period longer than SHUTDOWN_TIMEOUT_MS.'
    })
    server.closeAllConnections()
    process.exit(1)
  }, env.SHUTDOWN_TIMEOUT_MS)
  timeout.unref()

  try {
    if (server.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      ).catch(error => {
        process.exitCode = 1
        logger.error('HTTP listener shutdown failed', {
          component: 'api',
          stage: 'shutdown',
          ...errorDiagnostic(error, { component: 'api', stage: 'shutdown' })
        })
      })
    }
    stopMongoObservation()
    const results = await Promise.allSettled([
      database.disconnect(),
      redis.isOpen ? redis.close() : Promise.resolve()
    ])
    results.forEach((result, index) => {
      if (result.status !== 'rejected') return
      process.exitCode = 1
      const stage = index === 0 ? 'mongodb' : 'redis'
      logger.error('Data source shutdown failed', {
        component: 'api',
        stage,
        ...errorDiagnostic(result.reason, { component: 'api', stage })
      })
    })
  } finally {
    if (redis.isOpen) redis.destroy()
    clearTimeout(timeout)
  }
}

const fatal = (error: unknown) => {
  logger.error('Fatal application error', {
    component: 'api',
    stage: 'runtime',
    ...errorDiagnostic(error, { component: 'api', stage: 'runtime' })
  })
  void shutdown(1).catch(shutdownFailed)
}

let startupStage = 'storage'

try {
  await mkdir(storageRoot, { recursive: true })
  startupStage = 'mongodb'
  await database.connect()
  startupStage = 'redis'
  await redis.connect()
  startupStage = 'http'
  server.on('request', createApp())
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(env.APP_PORT, env.APP_HOST, () => {
      server.off('error', reject)
      resolve()
    })
  })
  // Install draining handlers after startup so a signal during startup cannot reopen closed clients.
  process.once('SIGINT', () => {
    void shutdown().catch(shutdownFailed)
  })
  process.once('SIGTERM', () => {
    void shutdown().catch(shutdownFailed)
  })
  process.once('uncaughtException', fatal)
  process.once('unhandledRejection', fatal)
  server.on('error', fatal)
  logger.info('API started', { port: env.APP_PORT, environment: env.NODE_ENV })
} catch (error) {
  logger.error('API startup failed', {
    component: 'api',
    stage: startupStage,
    ...errorDiagnostic(error, { component: 'api', stage: startupStage })
  })
  await shutdown(1).catch(shutdownFailed)
}
