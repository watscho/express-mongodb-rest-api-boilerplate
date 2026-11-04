import { randomUUID } from 'node:crypto'
import { mediaEnv } from '../../app/config/media.ts'
import type { ClientSession } from 'mongoose'
import { database } from '../../app/database/mongodb.ts'
import { AppError } from '../../app/http/errors.ts'
import { logger } from '../../app/runtime/logger.ts'
import { userService } from '../users/index.ts'
import type { AccountDto } from '../users/index.ts'
import { mediaRepository } from './repository.ts'
import { MAX_CONVERSION_BYTES } from './limits.ts'
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
  async reserveUpload(user: AccountDto): Promise<string> {
    const filename = randomUUID()
    await database.transaction(async session => {
      await userService.lockCurrent(user, session)
      const usage = await mediaRepository.usage(user.id, session)
      if (
        usage.count >= mediaEnv.MEDIA_MAX_FILES ||
        usage.bytes + mediaEnv.MAX_UPLOAD_BYTES + MAX_CONVERSION_BYTES >
          mediaEnv.MEDIA_MAX_TOTAL_BYTES
      )
        throw new AppError(413, 'media.quota_exceeded')
      await mediaRepository.reserve(filename, user.id, session)
    })
    return filename
  },
  async abandonUpload(filename: string, owner: string): Promise<void> {
    const record = await mediaRepository.markFailed(filename, owner)
    if (record) await mediaService.cleanupFiles([toOwnedImageDto(record)])
  },
  async upload(
    file: StoredImageDto,
    user: AccountDto
  ): Promise<UploadImageResponseDto> {
    if (!(await mediaRepository.reservation(file.filename, user.id)))
      throw new AppError(409, 'media.upload_reservation_expired')
    const image = new Image(file)
    try {
      await image.validate()
      const url = storageUrl(await image.resize())
      const media = await database.transaction(async session => {
        await userService.lockCurrent(user, session)
        const saved = await mediaRepository.finalize(file, user.id, session)
        if (!saved) throw new AppError(409, 'media.upload_reservation_expired')
        return saved
      })
      return { id: media._id.toString(), image: url }
    } catch (error) {
      await mediaService.abandonUpload(file.filename, user.id).catch(() =>
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
      images.map(async image => {
        await new Image(image).deleteFile()
        await mediaRepository.removeDeleted(image.id)
      })
    )
    results.forEach((result, index) => {
      if (result.status === 'rejected')
        logger.error('Media cleanup failed', { mediaId: images[index]?.id })
    })
  }
}
