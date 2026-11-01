import type { ApiRequest, ApiResponse } from '../../../app/http/dto.ts'
import { respond } from '../../../app/http/response.ts'
import { getAuth } from '../middleware.ts'
import type { AccessTokenDto, EmailRequestDto, TokenParamsDto } from '../dto.ts'
import { verificationService } from './service.ts'

export const verificationController = {
  async request(req: ApiRequest<EmailRequestDto>, res: ApiResponse) {
    await verificationService.request(
      getAuth(res).user,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'auth.verification_requested')
  },
  async confirm(
    req: ApiRequest<unknown, TokenParamsDto>,
    res: ApiResponse<AccessTokenDto>
  ) {
    const data = await verificationService.confirm(
      req.params.accessToken,
      req.get('Accept-Language')
    )
    respond(res, 'auth.email_verified', data)
  }
}
