import type { z } from 'zod'
import type {
  credentialsSchema,
  signUpSchema,
  emailRequestSchema,
  newPasswordSchema,
  updatePasswordSchema,
  deleteProfileSchema,
  tokenParamsSchema,
  accessTokenSchema,
  updateEmailResponseSchema,
  tokenClaimsSchema,
  authContextSchema,
  issueResetTokenSchema,
  resetTokenSchema,
  emailTokenSchema
} from './schemas.ts'

export type CredentialsDto = z.infer<typeof credentialsSchema>
export type SignUpDto = z.infer<typeof signUpSchema>
export type EmailRequestDto = z.infer<typeof emailRequestSchema>
export type NewPasswordDto = z.infer<typeof newPasswordSchema>
export type UpdatePasswordDto = z.infer<typeof updatePasswordSchema>
export type DeleteProfileDto = z.infer<typeof deleteProfileSchema>
export type TokenParamsDto = z.infer<typeof tokenParamsSchema>
export type AccessTokenDto = z.infer<typeof accessTokenSchema>
export type UpdateEmailResponseDto = z.infer<typeof updateEmailResponseSchema>
export type TokenClaimsDto = z.infer<typeof tokenClaimsSchema>
export type AuthContextDto = z.infer<typeof authContextSchema>
export type IssueResetTokenDto = z.infer<typeof issueResetTokenSchema>
export type EmailTokenDto = z.infer<typeof emailTokenSchema>
export type ResetTokenDto = z.infer<typeof resetTokenSchema>
