import { Router } from 'express'
import type { RequestHandler } from 'express'
import { validateRequest } from '../../app/http/middlewares/schema.ts'
import { authController } from './controller.ts'
import { authGuard } from './middleware.ts'
import { createVerificationRouter } from './verification/routes.ts'
import {
  credentialsSchema,
  signUpSchema,
  emailRequestSchema,
  newPasswordSchema,
  tokenParamsSchema,
  updatePasswordSchema,
  deleteProfileSchema
} from './schemas.ts'

export const createAuthRouter = (authRateLimit: RequestHandler) => {
  const router = Router()
  router.use('/auth', authRateLimit)
  router.post(
    '/auth/sign-in',
    authGuard.isGuest,
    validateRequest(credentialsSchema),
    authController.signIn
  )
  router.post(
    '/auth/sign-up',
    authGuard.isGuest,
    validateRequest(signUpSchema),
    authController.signUp
  )
  // Keep the legacy GET endpoint available for existing clients.
  router
    .route('/auth/sign-out')
    .post(authGuard.isAuth, authController.signOut)
    .get(authGuard.isAuth, authController.signOut)
  router.post(
    '/auth/password/reset',
    authGuard.isGuest,
    validateRequest(emailRequestSchema),
    authController.resetPassword
  )
  router.post(
    '/auth/password/new/:accessToken',
    validateRequest(tokenParamsSchema, 'params'),
    validateRequest(newPasswordSchema),
    authController.newPassword
  )
  router.use(createVerificationRouter(authRateLimit))
  router.post(
    '/user/update/email',
    authRateLimit,
    authGuard.isAuth,
    validateRequest(credentialsSchema),
    authController.updateEmail
  )
  router.post(
    '/user/update/password',
    authRateLimit,
    authGuard.isAuth,
    validateRequest(updatePasswordSchema),
    authController.updatePassword
  )
  router.post(
    '/user/delete',
    authRateLimit,
    authGuard.isAuth,
    validateRequest(deleteProfileSchema),
    authController.deleteProfile
  )
  return router
}
