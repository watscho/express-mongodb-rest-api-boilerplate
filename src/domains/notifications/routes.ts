import { Router } from 'express'
import type { ApiRequest, ApiResponse } from '../../app/http/dto.ts'
import { respond } from '../../app/http/response.ts'
import { authGuard } from '../auth/index.ts'
import { listEmailTemplates } from './registry.ts'
import type { TemplateListResponseDto } from './dto.ts'

export const createNotificationRouter = () => {
  const router = Router()
  router.get(
    '/notifications/templates',
    authGuard.isAuth,
    (_req: ApiRequest, res: ApiResponse<TemplateListResponseDto>) => {
      respond(res, 'notifications.templates_listed', {
        templates: listEmailTemplates()
      })
    }
  )
  return router
}
