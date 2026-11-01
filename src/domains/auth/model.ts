import { model, Schema } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

const resetSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      match: /^[a-f\d]{64}$/i
    },
    expiresIn: { type: Date, required: true }
  },
  { timestamps: true }
)
resetSchema.index(
  { user: 1 },
  { unique: true, name: 'reset_one_token_per_user' }
)
resetSchema.index({ expiresIn: 1 }, { expireAfterSeconds: 0 })

export type ResetPasswordDocument = HydratedDocument<
  InferSchemaType<typeof resetSchema>
>
export const ResetPassword = model('ResetPassword', resetSchema)
