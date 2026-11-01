import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import type { RequestHandler } from 'express'
import { redis } from '../../app/database/redis.ts'
import { AppError } from '../../app/http/errors.ts'
import type { ApiResponse } from '../../app/http/dto.ts'
import { userService } from '../users/index.ts'
import { jwtVerify, hashToken } from './utils.ts'
import type { AuthContextDto, TokenClaimsDto } from './dto.ts'

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    next()
    return
  }
  const accessToken = authorization.match(/^Bearer ([^\s]+)$/i)?.[1]
  if (!accessToken) throw new AppError(401, 'auth.invalid_access_token')
  let claims: TokenClaimsDto
  try {
    claims = jwtVerify(accessToken)
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof ZodError)
      throw new AppError(401, 'auth.invalid_access_token')
    throw error
  }
  if (await redis.exists(`expiredToken:${hashToken(accessToken)}`))
    throw new AppError(401, 'auth.invalid_access_token')
  const user = await userService.getById(claims.sub)
  if (!user || user.authVersion !== claims.version)
    throw new AppError(401, 'auth.invalid_access_token')
  res.locals.auth = {
    user,
    accessToken,
    expiresAt: claims.exp
  } satisfies AuthContextDto
  next()
}

export const getAuth = (res: {
  locals: Pick<ApiResponse['locals'], 'auth'>
}): AuthContextDto => {
  if (!res.locals.auth) throw new AppError(401, 'auth.authentication_required')
  return res.locals.auth
}

const isAuth: RequestHandler = (_req, res, next) => {
  getAuth(res)
  next()
}
const isGuest: RequestHandler = (_req, res, next) => {
  if (res.locals.auth) throw new AppError(403, 'auth.guest_required')
  next()
}
export const authGuard = { isAuth, isGuest }
