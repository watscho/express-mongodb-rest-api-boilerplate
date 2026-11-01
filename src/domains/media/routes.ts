import { Router } from 'express'
import { validateRequest } from '../../app/http/middlewares/schema.ts'
import { authGuard } from '../auth/index.ts'
import { mediaController } from './controller.ts'
import { updateAvatarSchema } from './schemas.ts'
import { uploadSingleImage } from './upload.ts'

export const createMediaRouter = () => {
  const router = Router()
  router.post(
    '/media/image/upload',
    authGuard.isAuth,
    uploadSingleImage,
    mediaController.imageUpload
  )
  router.post(
    '/user/update/avatar',
    authGuard.isAuth,
    validateRequest(updateAvatarSchema),
    mediaController.updateAvatar
  )
  return router
}
