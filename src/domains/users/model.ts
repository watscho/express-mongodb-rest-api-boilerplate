import { model, Schema } from 'mongoose'
import type { HydratedDocument, InferSchemaType } from 'mongoose'

const schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 60,
      maxlength: 60,
      match: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/
    },
    firstName: { type: String, trim: true, minlength: 2, maxlength: 48 },
    lastName: { type: String, trim: true, minlength: 2, maxlength: 48 },
    verified: { type: Boolean, default: false },
    authVersion: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger
    },
    // Serializes competing account mutations without invalidating active JWTs.
    mutationVersion: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger
    }
  },
  { timestamps: true }
)

schema.set('toJSON', {
  transform: (_doc, value) => {
    const { _id, email, firstName, lastName, verified, createdAt, updatedAt } =
      value
    return { _id, email, firstName, lastName, verified, createdAt, updatedAt }
  }
})

export type UserRecord = InferSchemaType<typeof schema>
export type UserDocument = HydratedDocument<UserRecord>
export const User = model('User', schema)
