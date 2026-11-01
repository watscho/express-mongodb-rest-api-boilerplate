import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'
import { logger } from '../../runtime/logger.ts'

export const requestMiddleware: RequestHandler = (req, res, next) => {
  const requestId = randomUUID()
  const started = performance.now()
  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  res.on('finish', () =>
    logger.info('HTTP request', {
      requestId,
      component: 'api',
      method: req.method,
      route:
        typeof req.route?.path === 'string' ? req.route.path : '[unmatched]',
      status: res.statusCode,
      durationMs: Math.round(performance.now() - started)
    })
  )
  next()
}
