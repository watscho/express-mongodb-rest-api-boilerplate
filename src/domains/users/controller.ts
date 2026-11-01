import type { ApiRequest, ApiResponse } from '../../app/http/dto.ts'
import { respond } from '../../app/http/response.ts'
import { getAuth } from '../auth/index.ts'
import { mediaService } from '../media/index.ts'
import { userService } from './service.ts'
import { toUserResponseDto } from './transformer.ts'
import type { UpdateProfileDto, UserResponseDto } from './dto.ts'

export const userController = {
  async me(_req: ApiRequest, res: ApiResponse<UserResponseDto>) {
    const { user } = getAuth(res)
    const image = await mediaService.avatarUrl(user.id)
    respond(res, 'users.profile_loaded', toUserResponseDto(user, image))
  },
  async updateProfile(
    req: ApiRequest<UpdateProfileDto>,
    res: ApiResponse<UpdateProfileDto>
  ) {
    const data = await userService.updateProfile(
      getAuth(res).user,
      req.body,
      req.get('Accept-Language')
    )
    respond(res, 'users.profile_updated', data)
  }
}
