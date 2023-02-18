import { ClientSession } from 'mongoose'

import { Verification } from '@/models'
import { createDateNow } from '@/utils/dates'

export const verificationService = {
  create: (
    {
      userId,
      email,
      accessToken,
      expiresIn
    }: {
      userId: string
      email: string
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) =>
    new Verification({
      userId,
      email,
      accessToken,
      expiresIn
    }).save({ session }),

  findOneAndUpdateByUserIdAndEmail: (
    {
      userId,
      email,
      accessToken,
      expiresIn
    }: {
      userId: string
      email: string
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) => {
    const data = [
      { userId, email },
      { userId, email, accessToken, expiresIn }
    ]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return Verification.findOneAndUpdate(...params)
  },

  getByValidAccessToken: (accessToken: string) =>
    Verification.findOne({
      accessToken,
      expiresIn: { $gte: createDateNow() }
    }),

  deleteManyByUserId: (userId: string, session?: ClientSession) =>
    Verification.deleteMany({ userId }, { session })
}
