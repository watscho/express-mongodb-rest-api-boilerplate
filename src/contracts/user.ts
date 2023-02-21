import { Model, ObjectId } from 'mongoose'

export interface IVerification {
  userId: string
  email: string
  accessToken: string
  expiresIn: Date
}

export interface IResetPassword {
  userId: string
  accessToken: string
  expiresIn: Date
}

export interface IUser {
  email: string
  password: string
  firstName?: string
  lastName?: string
  verified: boolean
  verifications: ObjectId[]
  resetPasswords: ObjectId[]
}

export interface IUserMethods {
  comparePassword: (password: string) => boolean
}

export type UserModel = Model<IUser, unknown, IUserMethods>

export type VerificationRequestPayload = Pick<IUser, 'email'>

export type UpdateProfilePayload = Required<
  Pick<IUser, 'firstName' | 'lastName'>
>

export type UpdateEmailPayload = Pick<IUser, 'email' | 'password'>

export interface UpdatePasswordPayload {
  oldPassword: string
  newPassword: string
}

export interface DeleteProfilePayload {
  password: string
}
