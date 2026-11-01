import type { MediaDocument } from './model.ts'
import type { z } from 'zod'
import type {
  storedImageSchema,
  ownedImageSchema,
  uploadImageResponseSchema,
  updateAvatarSchema
} from './schemas.ts'

export type StoredImageDto = z.infer<typeof storedImageSchema>
export type OwnedImageDto = z.infer<typeof ownedImageSchema>
export type UploadImageResponseDto = z.infer<typeof uploadImageResponseSchema>
export type UpdateAvatarDto = z.infer<typeof updateAvatarSchema>

export type OwnedImageRecordDto = Pick<
  MediaDocument,
  '_id' | 'owner' | keyof StoredImageDto
>
