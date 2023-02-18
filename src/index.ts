import express, { Express } from 'express'
import 'dotenv/config'

import '@/logger'
import { mongoose, redis } from '@/dataSources'
import {
  corsMiddleware,
  authMiddleware,
  notFoundMiddleware
} from '@/middlewares'
import { router } from '@/routes'
import { i18next, i18nextHttpMiddleware } from '@/i18n'

mongoose.run()
redis.run()

const app: Express = express()

app.use(
  express.json(),
  express.urlencoded({ extended: true }),
  corsMiddleware,
  i18nextHttpMiddleware.handle(i18next),
  authMiddleware,
  router,
  notFoundMiddleware
)

app.listen(process.env.PORT)
