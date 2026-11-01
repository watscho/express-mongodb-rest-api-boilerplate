import type { ClientSession } from 'mongoose'
import { hashToken } from '../utils.ts'
import { Verification } from './model.ts'
import { toVerificationTokenDto } from './transformer.ts'
import type { IssueVerificationTokenDto, VerificationTokenDto } from './dto.ts'

export const verificationRepository = {
  create: (
    { userId, email, accessToken, expiresIn }: IssueVerificationTokenDto,
    session: ClientSession
  ) =>
    Verification.findOneAndUpdate(
      { user: userId },
      {
        $set: { email, tokenHash: hashToken(accessToken), expiresIn }
      },
      { session, upsert: true, runValidators: true, returnDocument: 'after' }
    ),
  async consume(
    accessToken: string,
    session: ClientSession
  ): Promise<VerificationTokenDto | null> {
    const token = await Verification.findOneAndDelete(
      {
        tokenHash: hashToken(accessToken),
        expiresIn: { $gt: new Date() }
      },
      { session }
    )
    return token ? toVerificationTokenDto(token) : null
  },
  deleteForUser: (userId: string, session: ClientSession) =>
    Verification.deleteMany({ user: userId }, { session })
}
