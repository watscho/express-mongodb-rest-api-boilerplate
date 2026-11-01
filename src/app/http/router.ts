import { Router } from 'express'
import type { RequestHandler } from 'express'
import { createAuthRouter } from '../../domains/auth/routes.ts'
import { createUserRouter } from '../../domains/users/routes.ts'
import { createMediaRouter } from '../../domains/media/routes.ts'
import { createNotificationRouter } from '../../domains/notifications/routes.ts'

export const createRouter = (authRateLimit: RequestHandler) => {
  const router = Router()
  router.use(
    createAuthRouter(authRateLimit),
    createUserRouter(),
    createMediaRouter(),
    createNotificationRouter()
  )
  return router
}
