import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hash } from 'bcrypt'
import jwt from 'jsonwebtoken'
import { apiEnv as env } from '../../app/config/api.ts'
import type { AccountDto } from '../users/index.ts'
import { tokenClaimsSchema, passwordSchema } from './schemas.ts'
import type { AccessTokenDto, TokenClaimsDto, EmailTokenDto } from './dto.ts'

export const createEmailToken = (lifetimeDays: number): EmailTokenDto => ({
  accessToken: randomBytes(48).toString('hex'),
  expiresIn: new Date(Date.now() + lifetimeDays * 24 * 60 * 60 * 1000)
})
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')
export const hashPassword = (password: string) =>
  hash(passwordSchema.parse(password), env.BCRYPT_ROUNDS)

export const jwtSign = (user: AccountDto): AccessTokenDto => ({
  accessToken: jwt.sign({ version: user.authVersion }, env.JWT_SECRET, {
    subject: user.id,
    jwtid: randomUUID(),
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRATION,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  })
})
export const jwtVerify = (accessToken: string): TokenClaimsDto =>
  tokenClaimsSchema.parse(
    jwt.verify(accessToken, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    })
  )
