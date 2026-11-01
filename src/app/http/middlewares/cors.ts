import cors from 'cors'
import { apiEnv as env } from '../../config/api.ts'

export const corsMiddleware = cors({
  origin: new URL(env.CLIENT_URL).origin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept-Language'],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'Retry-After'],
  optionsSuccessStatus: 204
})
