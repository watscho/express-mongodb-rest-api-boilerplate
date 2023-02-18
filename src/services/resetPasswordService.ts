import { ClientSession } from 'mongoose'

import { ResetPassword } from '@/models'
import { createDateNow } from '@/utils/dates'

export const resetPasswordService = {
  create: (
    {
      userId,
      accessToken,
      expiresIn
    }: {
      userId: string
      accessToken: string
      expiresIn: Date
    },
    session?: ClientSession
  ) =>
    new ResetPassword({
      userId,
      accessToken,
      expiresIn
    }).save({ session }),

  getByValidAccessToken: (accessToken: string) =>
    ResetPassword.findOne({
      accessToken,
      expiresIn: { $gte: createDateNow() }
    }),

  deleteManyByUserId: (userId: string, session?: ClientSession) =>
    ResetPassword.deleteMany({ userId }, { session })
}
