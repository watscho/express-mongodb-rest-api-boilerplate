import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { join } from 'node:path'
import { apiEnv as env } from '../config/api.ts'
import { redis } from '../database/redis.ts'
import { createRouter } from './router.ts'
import { createDocumentationRouter } from './documentation/routes.ts'
import { authMiddleware } from '../../domains/auth/index.ts'
import { storageRoot } from '../../domains/media/index.ts'
import { corsMiddleware } from './middlewares/cors.ts'
import { errorMiddleware } from './middlewares/error.ts'
import { AppError } from './errors.ts'
import { requestMiddleware } from './middlewares/request.ts'
import { createRateLimits } from './middlewares/rateLimit.ts'
import type { LivenessResponseDto, ReadinessResponseDto } from './dto.ts'

export const createApp = () => {
  const app = express()
  const { apiRateLimit, authRateLimit } = createRateLimits()
  app.disable('x-powered-by')
  if (env.TRUST_PROXY) {
    app.set(
      'trust proxy',
      env.TRUST_PROXY.split(',').map(value => value.trim())
    )
  }
  app.use(requestMiddleware)
  app.use(
    helmet({
      strictTransportSecurity:
        env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  )
  app.use(corsMiddleware)

  app.get('/health/live', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json({ status: 'ok' } satisfies LivenessResponseDto)
  })
  app.get('/health/ready', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const ready = mongoose.connection.readyState === 1 && redis.isReady
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'unavailable'
    } satisfies ReadinessResponseDto)
  })

  app.use(
    `${env.STORAGE_URL.replace(/\/$/, '')}/conversions`,
    express.static(join(storageRoot, 'conversions'), {
      dotfiles: 'deny',
      index: false,
      maxAge: '1d',
      fallthrough: false
    })
  )
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(apiRateLimit)
  app.use(createDocumentationRouter())
  app.use(express.json({ limit: '100kb' }))
  app.use(
    express.urlencoded({
      limit: '100kb',
      extended: false,
      parameterLimit: 20
    })
  )
  app.use(
    authMiddleware,
    createRouter(authRateLimit),
    () => {
      throw new AppError(404)
    },
    errorMiddleware
  )
  return app
}
