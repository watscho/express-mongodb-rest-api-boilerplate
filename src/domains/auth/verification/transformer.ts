import type { VerificationDocument } from './model.ts'
import type { VerificationTokenDto } from './dto.ts'

export const toVerificationTokenDto = (
  token: VerificationDocument
): VerificationTokenDto => ({
  userId: token.user.toString(),
  email: token.email,
  expiresIn: token.expiresIn
})
