import { ClientSession, ObjectId } from 'mongoose'

import { User } from '@/models'

export const userService = {
  create: (
    {
      email,
      password,
      verified = false
    }: {
      email: string
      password: string
      verified?: boolean
    },
    session?: ClientSession
  ) =>
    new User({
      email,
      password,
      verified
    }).save({ session }),

  getById: (id: string, selectedFields = '_id email countries') =>
    User.findById(id).select(selectedFields),

  getByEmail: (email: string) => User.findOne({ email }),

  isExistByEmail: (email: string) => User.exists({ email }),

  updatePasswordByUserId: (
    userId: string,
    password: string,
    session?: ClientSession
  ) => {
    const data = [{ _id: userId }, { password, resetPasswords: [] }]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return User.updateOne(...params)
  },

  updateVerificationAndEmailByUserId: (
    userId: string,
    email: string,
    session?: ClientSession
  ) => {
    const data = [{ _id: userId }, { email, verified: true, verifications: [] }]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return User.updateOne(...params)
  },

  updateProfileByUserId: (
    userId: string,
    { firstName, lastName }: { firstName: string; lastName: string },
    session?: ClientSession
  ) => {
    const data = [{ _id: userId }, { firstName, lastName }]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return User.updateOne(...params)
  },

  updateEmailByUserId: (
    userId: string,
    email: string,
    session?: ClientSession
  ) => {
    const data = [{ _id: userId }, { email, verified: false }]

    let params = null

    if (session) {
      params = [...data, { session }]
    } else {
      params = data
    }

    return User.updateOne(...params)
  },

  deleteById: (userId: string, session?: ClientSession) =>
    User.deleteOne({ userId }, { session }),

  pushResetPasswordIdByUserId: async (
    {
      userId,
      resetPasswordId
    }: {
      userId: string
      resetPasswordId: string
    },
    session?: ClientSession
  ) => {
    let options = {}

    if (session) {
      options = { session }
    }

    const user = await User.findOne({ _id: userId }, null, options)

    if (user) {
      user.resetPasswords.push(resetPasswordId as unknown as ObjectId)
      await user.save({ session })
    }
  },

  pushVerificationsIdByUserId: async (
    {
      userId,
      verificationId
    }: {
      userId: string
      verificationId: string
    },
    session?: ClientSession
  ) => {
    let options = {}

    if (session) {
      options = { session }
    }

    const user = await User.findOne({ _id: userId }, null, options)

    if (user) {
      user.verifications.push(verificationId as unknown as ObjectId)
      await user.save({ session })
    }
  }
}
