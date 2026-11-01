import type { ClientSession } from 'mongoose'
import { database } from '../../../app/database/mongodb.ts'
import { AppError } from '../../../app/http/errors.ts'
import { userService } from '../../users/index.ts'
import type { AccountDto } from '../../users/dto.ts'
import { notificationService } from '../../notifications/index.ts'
import { createEmailToken, jwtSign } from '../utils.ts'
import type { AccessTokenDto, EmailRequestDto } from '../dto.ts'
import { verificationRepository } from './repository.ts'
import type { IssueVerificationTokenDto } from './dto.ts'

const VERIFICATION_LIFETIME_DAYS = 7

const invalidate = async (
  userId: string,
  session: ClientSession
): Promise<void> => {
  await verificationRepository.deleteForUser(userId, session)
  await notificationService.cancelPending(userId, session, ['verification'])
}

// Reuse the caller's transaction for signup/email changes; never open a nested one.
const issue = async (
  user: AccountDto,
  session: ClientSession,
  language?: string
): Promise<void> => {
  const current = await userService.lockCurrent(user, session)
  const token: IssueVerificationTokenDto = {
    userId: current.id,
    email: current.email,
    ...createEmailToken(VERIFICATION_LIFETIME_DAYS)
  }
  await notificationService.cancelPending(current.id, session, ['verification'])
  await verificationRepository.create(token, session)
  await notificationService.enqueueAccount(
    'verification',
    {
      email: token.email,
      accessToken: token.accessToken,
      language,
      ownerId: current.id,
      expiresAt: token.expiresIn
    },
    session
  )
}

export const verificationService = {
  issue,
  invalidate,
  async request(
    user: AccountDto,
    { email }: EmailRequestDto,
    language?: string
  ): Promise<void> {
    if (email !== user.email)
      throw new AppError(400, 'auth.email_change_requires_password')
    await database.transaction(session => issue(user, session, language))
  },
  async confirm(
    accessToken: string,
    language?: string
  ): Promise<AccessTokenDto> {
    const user = await database.transaction(async session => {
      const token = await verificationRepository.consume(accessToken, session)
      if (!token) throw new AppError(403, 'auth.invalid_or_expired_token')
      const current = await userService.getById(token.userId, session)
      if (!current || current.email !== token.email)
        throw new AppError(403, 'auth.invalid_or_expired_token')
      const updated = await userService.updateEmail(
        token.userId,
        token.email,
        true,
        session
      )
      if (!updated) throw new AppError(403, 'auth.invalid_or_expired_token')
      await invalidate(token.userId, session)
      await notificationService.enqueueAccount(
        'successfullyVerified',
        {
          email: updated.email,
          language,
          ownerId: updated.id
        },
        session
      )
      return updated
    })
    return jwtSign(user)
  }
}
