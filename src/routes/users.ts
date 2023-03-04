import { Router } from 'express'

import { authGuard } from '@/guards'
import { userController } from '@/controllers'
import { userValidation } from '@/validations'

export const users = (router: Router): void => {
  router.get('/me', authGuard.isAuth, userController.me)

  router.post(
    '/user/verification/request',
    authGuard.isAuth,
    userValidation.verificationRequest,
    userController.verificationRequest
  )

  router.get('/user/verification/:accessToken', userController.verification)

  router.post(
    '/user/update',
    authGuard.isAuth,
    userValidation.updateProfile,
    userController.updateProfile
  )

  router.post(
    '/user/update/email',
    authGuard.isAuth,
    userValidation.updateEmail,
    userController.updateEmail
  )

  router.post(
    '/user/update/password',
    authGuard.isAuth,
    userValidation.updatePassword,
    userController.updatePassword
  )

  router.post(
    '/user/update/avatar',
    authGuard.isAuth,
    userValidation.updateAvatar,
    userController.updateAvatar
  )

  router.post(
    '/user/delete',
    authGuard.isAuth,
    userValidation.deleteProfile,
    userController.deleteProfile
  )
}
