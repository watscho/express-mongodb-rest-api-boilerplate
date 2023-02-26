import { ClientSession, ObjectId } from 'mongoose'

import { ResetPassword } from '@/models'
import { createDateNow } from '@/utils/dates'

export const resetPasswordService = {
  create: (
    {
      userId,
      accessToken,
      expiresIn
    }: {
      userId: ObjectId
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) =>
    new ResetPassword({
      user: userId,
      accessToken,
      expiresIn
    }).save({ session }),

  getByValidAccessToken: (accessToken: string) =>
    ResetPassword.findOne({
      accessToken,
      expiresIn: { $gte: createDateNow() }
    }),

  deleteManyByUserId: (userId: ObjectId, session?: ClientSession) =>
    ResetPassword.deleteMany({ user: userId }, { session })
}
