import express, { Express } from 'express'
import { join } from 'path'
import 'dotenv/config'

import '@/infrastructure/logger'
import { mongoose, redis } from '@/dataSources'
import {
  corsMiddleware,
  authMiddleware,
  notFoundMiddleware
} from '@/middlewares'
import { router } from '@/routes'
import { i18next, i18nextHttpMiddleware } from '@/i18n'

// Validate JWT_SECRET at startup — reject empty/weak defaults
const KNOWN_WEAK_SECRETS = [
  '', 'secret', 'changeme', 'jwt_secret', 'your-secret-key',
]
if (!process.env.JWT_SECRET || KNOWN_WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
  throw new Error(
    'JWT_SECRET is not set or uses a known default value. ' +
    'Set JWT_SECRET in your .env file. ' +
    'Generate a secure key: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  )
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error(
    `JWT_SECRET must be at least 32 characters. Current length: ${process.env.JWT_SECRET.length}.`
  )
}

mongoose.run()
redis.run()

const app: Express = express()

app.use(
  join('/', process.env.STORAGE_PATH),
  express.static(join(__dirname, process.env.STORAGE_PATH))
)

app.use(
  express.json({ limit: '10mb' }),
  express.urlencoded({ limit: '10mb', extended: true }),
  corsMiddleware,
  i18nextHttpMiddleware.handle(i18next),
  authMiddleware,
  router,
  notFoundMiddleware
)

app.listen(process.env.APP_PORT)
