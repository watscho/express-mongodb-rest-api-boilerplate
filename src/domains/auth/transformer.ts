import type { ResetPasswordDocument } from './model.ts'
import type { ResetTokenDto } from './dto.ts'

export const toResetTokenDto = (
  token: ResetPasswordDocument
): ResetTokenDto => ({
  userId: token.user.toString(),
  expiresIn: token.expiresIn
})
