import { database } from '../../app/database/mongodb.ts'
import type { ClientSession } from 'mongoose'
import { compare } from 'bcrypt'
import { consumeAccountBudget } from './admission.ts'
import { credentialsSchema } from './schemas.ts'
import { redis } from '../../app/database/redis.ts'
import { AppError } from '../../app/http/errors.ts'
import { userService } from '../users/index.ts'
import type { AccountDto } from '../users/index.ts'
import { mediaService } from '../media/index.ts'
import { notificationService } from '../notifications/index.ts'
import { tokenRepository } from './repository.ts'
import { verificationService } from './verification/index.ts'
import { hashPassword, createEmailToken, hashToken, jwtSign } from './utils.ts'
import type {
  CredentialsDto,
  SignUpDto,
  EmailRequestDto,
  NewPasswordDto,
  UpdatePasswordDto,
  DeleteProfileDto,
  AccessTokenDto,
  AuthContextDto,
  UpdateEmailResponseDto
} from './dto.ts'

const RESET_PASSWORD_LIFETIME_DAYS = 1

const confirmPassword = async (
  user: AccountDto,
  password: string
): Promise<void> => {
  await consumeAccountBudget(user.email, 'confirmation')
  const current = await userService.getCredentialsById(user.id)
  if (
    !current ||
    current.authVersion !== user.authVersion ||
    !(await compare(password, current.password))
  )
    throw new AppError(403, 'auth.password_confirmation_failed')
}

const invalidateSecurityLinks = async (
  userId: string,
  session: ClientSession
): Promise<void> => {
  await tokenRepository.deleteResets(userId, session)
  await verificationService.invalidate(userId, session)
  await notificationService.cancelPending(userId, session, ['resetPassword'])
}

export const authService = {
  async signIn(input: CredentialsDto): Promise<AccessTokenDto> {
    const { email, password } = credentialsSchema.parse(input)
    await consumeAccountBudget(email, 'sign-in')
    const user = await userService.getCredentialsByEmail(email)
    if (!user || !(await compare(password, user.password)))
      throw new AppError(401, 'auth.invalid_credentials')
    return jwtSign(user)
  },
  async signUp(
    { email, password }: SignUpDto,
    language?: string
  ): Promise<AccessTokenDto> {
    if (await userService.existsByEmail(email))
      throw new AppError(409, 'users.email_taken')
    const hashedPassword = await hashPassword(password)
    const user = await database.transaction(async session => {
      const created = await userService.create(
        { email, password: hashedPassword },
        session
      )
      await notificationService.enqueueAccount(
        'signUp',
        { email, language, ownerId: created.id },
        session
      )
      await verificationService.issue(created, session, language)
      return created
    })
    return jwtSign(user)
  },
  async signOut({ accessToken, expiresAt }: AuthContextDto): Promise<void> {
    const ttl = expiresAt - Math.floor(Date.now() / 1000)
    if (ttl > 0)
      await redis.set(`expiredToken:${hashToken(accessToken)}`, '1', {
        EX: ttl
      })
  },
  async resetPassword(
    { email }: EmailRequestDto,
    language?: string
  ): Promise<void> {
    const user = await userService.getByEmail(email)
    if (!user) return
    const { accessToken, expiresIn: expiresAt } = createEmailToken(
      RESET_PASSWORD_LIFETIME_DAYS
    )
    try {
      await database.transaction(async session => {
        const current = await userService.lock(user.id, session)
        if (!current || current.email !== email) return
        await notificationService.cancelPending(user.id, session, [
          'resetPassword'
        ])
        await tokenRepository.createReset(
          {
            userId: user.id,
            accessToken,
            expiresIn: expiresAt
          },
          session
        )
        await notificationService.enqueueAccount(
          'resetPassword',
          { email, accessToken, language, ownerId: user.id, expiresAt },
          session
        )
      })
    } catch (error) {
      // A rejected notification rolls back token replacement and retains the generic reset response.
      if (!(error instanceof AppError && error.status === 429)) throw error
    }
  },
  async newPassword(
    accessToken: string,
    { password }: NewPasswordDto,
    language?: string
  ): Promise<AccessTokenDto> {
    const hashedPassword = await hashPassword(password)
    const user = await database.transaction(async session => {
      const token = await tokenRepository.consumeReset(accessToken, session)
      if (!token) throw new AppError(403, 'auth.invalid_or_expired_token')
      const current = await userService.updatePassword(
        token.userId,
        hashedPassword,
        session
      )
      if (!current) throw new AppError(403, 'auth.invalid_or_expired_token')
      await invalidateSecurityLinks(token.userId, session)
      await notificationService.enqueueAccount(
        'successfullyUpdatedPassword',
        { email: current.email, language, ownerId: current.id },
        session
      )
      return current
    })
    return jwtSign(user)
  },
  async updateEmail(
    user: AccountDto,
    { email, password }: CredentialsDto,
    language?: string
  ): Promise<UpdateEmailResponseDto> {
    await confirmPassword(user, password)
    if (email === user.email) return { email }
    const updated = await database.transaction(async session => {
      await userService.lockCurrent(user, session)
      if (await userService.existsByEmail(email, session))
        throw new AppError(409, 'users.email_taken')
      const current = await userService.updateEmail(
        user.id,
        email,
        false,
        session
      )
      if (!current) throw new AppError(401, 'auth.session_expired')
      await tokenRepository.deleteResets(user.id, session)
      await notificationService.cancelPending(user.id, session, [
        'resetPassword'
      ])
      await notificationService.enqueueAccount(
        'successfullyUpdatedEmail',
        { email: user.email, language, ownerId: user.id },
        session
      )
      await verificationService.issue(current, session, language)
      return current
    })
    return { email, ...jwtSign(updated) }
  },
  async updatePassword(
    user: AccountDto,
    { oldPassword, newPassword }: UpdatePasswordDto,
    language?: string
  ): Promise<AccessTokenDto> {
    await confirmPassword(user, oldPassword)
    const hashedPassword = await hashPassword(newPassword)
    const updated = await database.transaction(async session => {
      await userService.lockCurrent(user, session)
      const current = await userService.updatePassword(
        user.id,
        hashedPassword,
        session
      )
      if (!current) throw new AppError(401, 'auth.session_expired')
      await invalidateSecurityLinks(user.id, session)
      await notificationService.enqueueAccount(
        'successfullyUpdatedPassword',
        { email: current.email, language, ownerId: current.id },
        session
      )
      return current
    })
    return jwtSign(updated)
  },
  async deleteProfile(
    user: AccountDto,
    { password }: DeleteProfileDto,
    language?: string
  ): Promise<void> {
    await confirmPassword(user, password)
    const images = await database.transaction(async session => {
      await userService.lockCurrent(user, session)
      const owned = await mediaService.deleteOwned(user.id, session)
      await tokenRepository.deleteResets(user.id, session)
      await verificationService.invalidate(user.id, session)
      await notificationService.cancelPending(user.id, session)
      await userService.delete(user.id, session)
      await notificationService.enqueueAccount(
        'successfullyDeleted',
        { email: user.email, language, ownerId: user.id },
        session
      )
      return owned
    })
    // Filesystem deletion follows commit, so a rollback preserves existing files.
    await mediaService.cleanupFiles(images)
  }
}
