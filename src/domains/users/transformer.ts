import type {
  AccountRecordDto,
  CredentialsRecordDto,
  AccountDto,
  AccountCredentialsDto,
  UserResponseDto
} from './dto.ts'

export const toAccountDto = (user: AccountRecordDto): AccountDto => ({
  id: user._id.toString(),
  email: user.email,
  firstName: user.firstName ?? undefined,
  lastName: user.lastName ?? undefined,
  verified: user.verified ?? false,
  authVersion: user.authVersion,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
})

export const toAccountCredentialsDto = (
  user: CredentialsRecordDto
): AccountCredentialsDto => ({
  ...toAccountDto(user),
  password: user.password
})

export const toUserResponseDto = (
  user: AccountDto,
  image?: string
): UserResponseDto => ({
  _id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  verified: user.verified,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  ...(image === undefined ? {} : { image })
})
