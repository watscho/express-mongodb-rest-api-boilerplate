import express from 'express'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after } from 'node:test'
import { replace, methods, user, logger } from './helpers.mjs'
import { AppError } from '../../dist/app/http/errors.js'
export const routeFixture = async () => {
  const storageRoot = await mkdtemp(join(tmpdir(), 'unit-routes-'))
  after(() => rm(storageRoot, { recursive: true, force: true }))
  const auth = methods([
    'signIn',
    'signUp',
    'signOut',
    'resetPassword',
    'newPassword',
    'updateEmail',
    'updatePassword',
    'deleteProfile'
  ])
  const users = methods(['updateProfile'])
  const media = methods([
    'avatarUrl',
    'upload',
    'updateAvatar',
    'reserveUpload',
    'abandonUpload'
  ])
  media.reserveUpload.mock.mockImplementation(
    async () => '11111111-1111-4111-8111-111111111111'
  )
  const verification = methods(['request', 'confirm'])
  const getAuth = res => {
    if (!res.locals.auth)
      throw new AppError(401, 'auth.authentication_required')
    return res.locals.auth
  }
  const authGuard = {
    isAuth: (_req, res, next) => {
      getAuth(res)
      next()
    },
    isGuest: (_req, res, next) => {
      if (res.locals.auth) throw new AppError(403, 'auth.guest_required')
      next()
    }
  }
  replace('domains/auth/middleware.js', { authGuard, getAuth })
  replace('domains/auth/index.js', { authGuard, getAuth })
  replace('domains/auth/service.js', { authService: auth })
  replace('domains/users/service.js', { userService: users })
  replace('domains/media/service.js', { mediaService: media })
  replace('domains/media/index.js', { mediaService: media })
  replace('domains/auth/verification/service.js', {
    verificationService: verification
  })
  replace('domains/media/utils.js', { storageRoot })
  replace('app/runtime/logger.js', { logger })
  const { errorMiddleware } =
    await import('../../dist/app/http/middlewares/error.js')
  return {
    auth,
    users,
    media,
    verification,
    storageRoot,
    app(router) {
      const app = express()
      app.use(express.json())
      app.use((req, res, next) => {
        if (req.headers.authorization)
          res.locals.auth = { user, accessToken: 'jwt', expiresAt: 123 }
        next()
      })
      app.use(router)
      app.use(errorMiddleware)
      return app
    }
  }
}
