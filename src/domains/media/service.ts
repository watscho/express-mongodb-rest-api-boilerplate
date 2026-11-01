import type { ClientSession } from 'mongoose'
import { database } from '../../app/database/mongodb.ts'
import { AppError } from '../../app/http/errors.ts'
import { logger } from '../../app/runtime/logger.ts'
import { userService } from '../users/index.ts'
import type { AccountDto } from '../users/index.ts'
import { mediaRepository } from './repository.ts'
import { Image } from './image.ts'
import { storageUrl } from './utils.ts'
import { toOwnedImageDto } from './transformer.ts'
import type {
  StoredImageDto,
  UploadImageResponseDto,
  UpdateAvatarDto,
  OwnedImageDto
} from './dto.ts'

export const mediaService = {
  async upload(
    file: StoredImageDto,
    user: AccountDto
  ): Promise<UploadImageResponseDto> {
    const image = new Image(file)
    try {
      await image.validate()
      const url = storageUrl(await image.resize())
      const media = await database.transaction(async session => {
        await userService.lockCurrent(user, session)
        return mediaRepository.create(file, user.id, session)
      })
      return { id: media._id.toString(), image: url }
    } catch (error) {
      await image.deleteFile().catch(() =>
        logger.error('Failed to clean up rejected image', {
          filename: file.filename
        })
      )
      throw error
    }
  },
  async avatarUrl(userId: string): Promise<string | undefined> {
    const image = await mediaRepository.getAvatar(userId)
    return image
      ? storageUrl(await new Image(toOwnedImageDto(image)).resize())
      : undefined
  },
  async updateAvatar(
    user: AccountDto,
    { imageId }: UpdateAvatarDto
  ): Promise<void> {
    await database.transaction(async session => {
      await userService.lockCurrent(user, session)
      if (!(await mediaRepository.existsOwned(imageId, user.id, session)))
        throw new AppError(404, 'media.image_not_found')
      await mediaRepository.detachAvatar(user.id, session)
      await mediaRepository.attachAvatar(imageId, user.id, session)
    })
  },
  async deleteOwned(
    userId: string,
    session: ClientSession
  ): Promise<OwnedImageDto[]> {
    const images = await mediaRepository.listOwned(userId, session)
    await mediaRepository.deleteOwned(userId, session)
    return images.map(toOwnedImageDto)
  },
  async cleanupFiles(images: OwnedImageDto[]): Promise<void> {
    const results = await Promise.allSettled(
      images.map(image => new Image(image).deleteFile())
    )
    results.forEach((result, index) => {
      if (result.status === 'rejected')
        logger.error('Media cleanup failed', { mediaId: images[index]?.id })
    })
  }
}
