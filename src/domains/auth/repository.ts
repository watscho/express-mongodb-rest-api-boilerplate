import type { ClientSession } from 'mongoose'
import { ResetPassword } from './model.ts'
import { hashToken } from './utils.ts'
import { toResetTokenDto } from './transformer.ts'
import type { IssueResetTokenDto, ResetTokenDto } from './dto.ts'

export const tokenRepository = {
  createReset: (
    { userId, accessToken, expiresIn }: IssueResetTokenDto,
    session: ClientSession
  ) =>
    ResetPassword.findOneAndUpdate(
      { user: userId },
      {
        $set: { tokenHash: hashToken(accessToken), expiresIn }
      },
      { session, upsert: true, runValidators: true, returnDocument: 'after' }
    ),
  async consumeReset(
    accessToken: string,
    session: ClientSession
  ): Promise<ResetTokenDto | null> {
    const token = await ResetPassword.findOneAndDelete(
      { tokenHash: hashToken(accessToken), expiresIn: { $gt: new Date() } },
      { session }
    )
    return token ? toResetTokenDto(token) : null
  },
  deleteResets: (user: string, session: ClientSession) =>
    ResetPassword.deleteMany({ user }, { session })
}
