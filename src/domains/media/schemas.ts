import { z } from 'zod'
import { objectIdSchema } from '../users/schemas.ts'

export const imageMimeSchema = z.enum(['image/jpeg', 'image/png'])
export const storedImageSchema = z.object({
  originalname: z.string(),
  encoding: z.string(),
  mimetype: imageMimeSchema,
  destination: z.string(),
  filename: z.string(),
  path: z.string(),
  size: z.number().int().nonnegative()
})
export const ownedImageSchema = storedImageSchema.extend({
  id: objectIdSchema,
  owner: objectIdSchema
})
export const uploadImageResponseSchema = z.object({
  id: objectIdSchema,
  image: z.url()
})
export const updateAvatarSchema = z.object({ imageId: objectIdSchema })
