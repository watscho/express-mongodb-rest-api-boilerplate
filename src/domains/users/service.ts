import type { ClientSession } from 'mongoose'
import { database } from '../../app/database/mongodb.ts'
import { AppError } from '../../app/http/errors.ts'
import { notificationService } from '../notifications/index.ts'
import { userRepository } from './repository.ts'
import type { AccountDto, UpdateProfileDto } from './dto.ts'

export const userService = {
  getById: userRepository.getById,
  getByEmail: userRepository.getByEmail,
  getCredentialsById: userRepository.getCredentialsById,
  getCredentialsByEmail: userRepository.getCredentialsByEmail,
  existsByEmail: userRepository.existsByEmail,
  create: userRepository.create,
  lock: userRepository.lock,
  updatePassword: userRepository.updatePassword,
  updateEmail: userRepository.updateEmail,
  delete: userRepository.delete,
  async lockCurrent(
    user: AccountDto,
    session: ClientSession
  ): Promise<AccountDto> {
    const current = await userRepository.lock(
      user.id,
      session,
      user.authVersion
    )
    if (!current) throw new AppError(401, 'auth.session_expired')
    return current
  },
  async updateProfile(
    user: AccountDto,
    payload: UpdateProfileDto,
    language?: string
  ): Promise<UpdateProfileDto> {
    await database.transaction(async session => {
      const current = await userService.lockCurrent(user, session)
      if (
        current.firstName === payload.firstName &&
        current.lastName === payload.lastName
      )
        return
      await userRepository.updateProfile(user.id, payload, session)
      await notificationService.enqueueAccount(
        'successfullyUpdatedProfile',
        { email: user.email, language, ownerId: user.id },
        session
      )
    })
    return { firstName: payload.firstName, lastName: payload.lastName }
  }
}
