import { Router } from 'express'
import { validateRequest } from '../../app/http/middlewares/schema.ts'
import { authGuard } from '../auth/index.ts'
import { userController } from './controller.ts'
import { updateProfileSchema } from './schemas.ts'

export const createUserRouter = () => {
  const router = Router()
  router.get('/me', authGuard.isAuth, userController.me)
  router.post(
    '/user/update',
    authGuard.isAuth,
    validateRequest(updateProfileSchema),
    userController.updateProfile
  )
  return router
}
