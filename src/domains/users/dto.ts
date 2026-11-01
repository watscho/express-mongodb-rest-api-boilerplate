import type { UserDocument } from './model.ts'
import type { z } from 'zod'
import type {
  updateProfileSchema,
  accountSchema,
  accountCredentialsSchema,
  createAccountSchema,
  userResponseSchema
} from './schemas.ts'

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
export type AccountDto = z.infer<typeof accountSchema>
export type AccountCredentialsDto = z.infer<typeof accountCredentialsSchema>
export type CreateAccountDto = z.infer<typeof createAccountSchema>
export type UserResponseDto = z.infer<typeof userResponseSchema>

export type AccountRecordDto = Pick<
  UserDocument,
  '_id' | Exclude<keyof AccountDto, 'id'>
>
export type CredentialsRecordDto = AccountRecordDto &
  Pick<UserDocument, 'password'>
