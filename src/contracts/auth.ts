import { IUser } from './user'

export type SignInPayload = Pick<IUser, 'email' | 'password'>

export type SignUpPayload = Pick<IUser, 'email' | 'password'>

export type ResetPasswordPayload = Pick<IUser, 'email'>

export type NewPasswordPayload = Pick<IUser, 'password'>
