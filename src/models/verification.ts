import { Schema, model } from 'mongoose'

import { IVerification } from '@/contracts/user'

const schema = new Schema<IVerification>(
  {
    userId: String,
    email: String,
    accessToken: String,
    expiresIn: Date
  },
  { timestamps: true }
)

export const Verification = model<IVerification>('Verification', schema)
