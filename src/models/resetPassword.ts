import { Schema, model } from 'mongoose'

import { IResetPassword } from '@/contracts/user'

const schema = new Schema<IResetPassword>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    accessToken: String,
    expiresIn: Date
  },
  { timestamps: true }
)

export const ResetPassword = model<IResetPassword>('ResetPassword', schema)
