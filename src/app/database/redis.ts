import { createClient } from 'redis'
import { apiEnv as env } from '../config/api.ts'
import { logger } from '../runtime/logger.ts'
import { errorDiagnostic } from '../runtime/diagnostics/diagnostic.ts'
import { DiagnosticError } from '../runtime/diagnostics/errors.ts'

let hasConnected = false
let lastFailureCode: string | undefined

export const redis = createClient({
  url: env.REDIS_URI,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: retries => {
      // Fail bounded initial startup; recover automatically after later outages.
      if (!hasConnected && retries >= 5) {
        return new DiagnosticError({
          code: 'REDIS_STARTUP_EXHAUSTED',
          reason: 'Initial Redis connection attempts are exhausted.',
          hint: 'Correct the preceding Redis connection failure, then restart the API. Check REDIS_URI, credentials, DNS, and network availability.'
        })
      }
      return Math.min(100 * 2 ** Math.min(retries, 5), 3000)
    }
  }
})

redis.on('ready', () => {
  if (hasConnected && lastFailureCode)
    logger.info('Redis connection restored', {
      component: 'api',
      stage: 'redis',
      code: 'REDIS_RECONNECTED'
    })
  hasConnected = true
  lastFailureCode = undefined
})
redis.on('error', error => {
  const diagnostic = errorDiagnostic(error, {
    component: 'api',
    stage: 'redis'
  })
  if (diagnostic.code !== lastFailureCode)
    logger.error('Redis connection error', {
      component: 'api',
      stage: 'redis',
      ...diagnostic
    })
  lastFailureCode = diagnostic.code
})
