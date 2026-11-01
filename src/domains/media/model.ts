import { model, Schema } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'
import { imageMimeSchema } from './schemas.ts'

const schema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    originalname: { type: String, required: true },
    encoding: { type: String, required: true },
    mimetype: { type: String, required: true, enum: imageMimeSchema.options },
    destination: { type: String, required: true },
    filename: { type: String, required: true },
    path: { type: String, required: true },
    size: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    },
    refType: { type: String, enum: ['User'] },
    refId: { type: Schema.Types.ObjectId }
  },
  { timestamps: true }
)

schema.index(
  { owner: 1, refType: 1, refId: 1 },
  { name: 'media_owner_attachment' }
)
export type MediaDocument = HydratedDocument<InferSchemaType<typeof schema>>
export const Media = model('Media', schema)
