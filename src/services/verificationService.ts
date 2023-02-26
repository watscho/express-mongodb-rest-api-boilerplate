import { ClientSession, ObjectId } from 'mongoose'

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
      userId: ObjectId
      email: string
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) =>
    new Verification({
      user: userId,
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
      userId: ObjectId
      email: string
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) => {
    const data = [
      { user: userId, email },
      { user: userId, email, accessToken, expiresIn }
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

  deleteManyByUserId: (userId: ObjectId, session?: ClientSession) =>
    Verification.deleteMany({ user: userId }, { session })
}
