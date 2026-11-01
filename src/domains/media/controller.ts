import type { ApiRequest, ApiResponse } from '../../app/http/dto.ts'
import { respond } from '../../app/http/response.ts'
import { getAuth } from '../auth/index.ts'
import { mediaService } from './service.ts'
import { toStoredImageDto } from './transformer.ts'
import type { UpdateAvatarDto, UploadImageResponseDto } from './dto.ts'

export const mediaController = {
  async imageUpload(req: ApiRequest, res: ApiResponse<UploadImageResponseDto>) {
    const file = toStoredImageDto(req.file)
    respond(
      res,
      'media.image_uploaded',
      await mediaService.upload(file, getAuth(res).user)
    )
  },
  async updateAvatar(req: ApiRequest<UpdateAvatarDto>, res: ApiResponse) {
    await mediaService.updateAvatar(getAuth(res).user, req.body)
    respond(res, 'media.avatar_updated')
  }
}
