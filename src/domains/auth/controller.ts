import type { ApiRequest, ApiResponse } from '../../app/http/dto.ts'
import { respond } from '../../app/http/response.ts'
import { authService } from './service.ts'
import { getAuth } from './middleware.ts'
import type {
  CredentialsDto,
  SignUpDto,
  EmailRequestDto,
  NewPasswordDto,
  UpdatePasswordDto,
  DeleteProfileDto,
  TokenParamsDto,
  AccessTokenDto,
  UpdateEmailResponseDto
} from './dto.ts'

export const authController = {
  async signIn(
    req: ApiRequest<CredentialsDto>,
    res: ApiResponse<AccessTokenDto>
  ) {
    respond(res, 'auth.signed_in', await authService.signIn(req.body))
  },
  async signUp(req: ApiRequest<SignUpDto>, res: ApiResponse<AccessTokenDto>) {
    const data = await authService.signUp(req.body, req.get('Accept-Language'))
    respond(res, 'auth.signed_up', data)
  },
  async signOut(_req: ApiRequest, res: ApiResponse) {
    await authService.signOut(getAuth(res))
    respond(res, 'auth.signed_out')
  },
  async resetPassword(req: ApiRequest<EmailRequestDto>, res: ApiResponse) {
    await authService.resetPassword(req.body, req.get('Accept-Language'))
    respond(res, 'auth.password_reset_requested')
  },
  async newPassword(
    req: ApiRequest<NewPasswordDto, TokenParamsDto>,
    res: ApiResponse<AccessTokenDto>
  ) {
    const data = await authService.newPassword(
      req.params.accessToken,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'auth.password_updated', data)
  },
  async updateEmail(
    req: ApiRequest<CredentialsDto>,
    res: ApiResponse<UpdateEmailResponseDto>
  ) {
    const data = await authService.updateEmail(
      getAuth(res).user,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'auth.email_update_completed', data)
  },
  async updatePassword(
    req: ApiRequest<UpdatePasswordDto>,
    res: ApiResponse<AccessTokenDto>
  ) {
    const data = await authService.updatePassword(
      getAuth(res).user,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'auth.password_updated', data)
  },
  async deleteProfile(req: ApiRequest<DeleteProfileDto>, res: ApiResponse) {
    await authService.deleteProfile(
      getAuth(res).user,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'users.profile_deleted')
  }
}
