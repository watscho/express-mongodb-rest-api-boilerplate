import type { ClientSession } from 'mongoose'
import { User } from './model.ts'
import { toAccountDto, toAccountCredentialsDto } from './transformer.ts'
import type {
  AccountDto,
  AccountCredentialsDto,
  CreateAccountDto,
  UpdateProfileDto
} from './dto.ts'

const accountProjection =
  'email firstName lastName verified authVersion createdAt updatedAt'

export const userRepository = {
  async getById(
    id: string,
    session?: ClientSession
  ): Promise<AccountDto | null> {
    const user = await User.findById(id, accountProjection, { session })
      .lean()
      .exec()
    return user ? toAccountDto(user) : null
  },
  async getByEmail(email: string): Promise<AccountDto | null> {
    const user = await User.findOne({ email })
      .select(accountProjection)
      .lean()
      .exec()
    return user ? toAccountDto(user) : null
  },
  async getCredentialsById(id: string): Promise<AccountCredentialsDto | null> {
    const user = await User.findById(id)
      .select(`${accountProjection} +password`)
      .lean()
      .exec()
    return user ? toAccountCredentialsDto(user) : null
  },
  async getCredentialsByEmail(
    email: string
  ): Promise<AccountCredentialsDto | null> {
    const user = await User.findOne({ email })
      .select(`${accountProjection} +password`)
      .lean()
      .exec()
    return user ? toAccountCredentialsDto(user) : null
  },
  async existsByEmail(
    email: string,
    session?: ClientSession
  ): Promise<boolean> {
    return Boolean(
      await User.exists({ email })
        .session(session ?? null)
        .exec()
    )
  },
  async create(
    { email, password }: CreateAccountDto,
    session: ClientSession
  ): Promise<AccountDto> {
    return toAccountDto(await new User({ email, password }).save({ session }))
  },
  async lock(
    id: string,
    session: ClientSession,
    authVersion?: number
  ): Promise<AccountDto | null> {
    const user = await User.findOneAndUpdate(
      { _id: id, ...(authVersion === undefined ? {} : { authVersion }) },
      { $inc: { mutationVersion: 1 } },
      { session, returnDocument: 'after' }
    )
      .select(accountProjection)
      .lean()
      .exec()
    return user ? toAccountDto(user) : null
  },
  async updateProfile(
    id: string,
    payload: UpdateProfileDto,
    session: ClientSession
  ): Promise<void> {
    await User.updateOne(
      { _id: id },
      { $set: { firstName: payload.firstName, lastName: payload.lastName } },
      { session, runValidators: true }
    ).exec()
  },
  async updatePassword(
    id: string,
    password: string,
    session: ClientSession
  ): Promise<AccountDto | null> {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { password }, $inc: { authVersion: 1 } },
      { session, runValidators: true, returnDocument: 'after' }
    )
      .select(accountProjection)
      .lean()
      .exec()
    return user ? toAccountDto(user) : null
  },
  async updateEmail(
    id: string,
    email: string,
    verified: boolean,
    session: ClientSession
  ): Promise<AccountDto | null> {
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { email, verified }, $inc: { authVersion: 1 } },
      { session, runValidators: true, returnDocument: 'after' }
    )
      .select(accountProjection)
      .lean()
      .exec()
    return user ? toAccountDto(user) : null
  },
  async delete(id: string, session: ClientSession): Promise<void> {
    await User.deleteOne({ _id: id }, { session }).exec()
  }
}
