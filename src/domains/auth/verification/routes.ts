import { Router } from 'express'
import type { RequestHandler } from 'express'
import { validateRequest } from '../../../app/http/middlewares/schema.ts'
import { authGuard } from '../middleware.ts'
import { verificationController } from './controller.ts'
import { emailRequestSchema, tokenParamsSchema } from '../schemas.ts'

export const createVerificationRouter = (authRateLimit: RequestHandler) => {
  const router = Router()
  router.post(
    '/user/verification/request',
    authRateLimit,
    authGuard.isAuth,
    validateRequest(emailRequestSchema),
    verificationController.request
  )
  router.get(
    '/user/verification/:accessToken',
    authRateLimit,
    validateRequest(tokenParamsSchema, 'params'),
    verificationController.confirm
  )
  return router
}
