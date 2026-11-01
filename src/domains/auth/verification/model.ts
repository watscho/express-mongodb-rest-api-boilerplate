import { model, Schema } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

const verificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254
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
verificationSchema.index(
  { user: 1 },
  { unique: true, name: 'verification_one_token_per_user' }
)
verificationSchema.index({ expiresIn: 1 }, { expireAfterSeconds: 0 })

export type VerificationDocument = HydratedDocument<
  InferSchemaType<typeof verificationSchema>
>
export const Verification = model('Verification', verificationSchema)
