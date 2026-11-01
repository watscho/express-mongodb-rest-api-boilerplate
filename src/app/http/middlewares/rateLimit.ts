import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import type { RedisReply } from 'rate-limit-redis'
import { apiEnv as env } from '../../config/api.ts'
import { redis } from '../../database/redis.ts'
import { createErrorResponse } from '../response.ts'

const createLimiter = (prefix: string, limit: number) =>
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit,
    store: new RedisStore({
      prefix,
      sendCommand: (...args: string[]) => redis.sendCommand<RedisReply>(args)
    }),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: false,
    message: createErrorResponse(429)
  })

export const createRateLimits = () => ({
  apiRateLimit: createLimiter('rateLimit:api:', env.RATE_LIMIT_MAX),
  authRateLimit: createLimiter('rateLimit:auth:', env.AUTH_RATE_LIMIT_MAX)
})
