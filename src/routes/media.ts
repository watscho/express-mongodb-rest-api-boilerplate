import { Router } from 'express'

import { authGuard } from '@/guards'
import { mediaController } from '@/controllers'
import { multerMiddleware } from '@/middlewares'

export const media = (router: Router): void => {
  router.post(
    '/media/create',
    authGuard.isAuth,
    multerMiddleware,
    mediaController.create
  )
}
