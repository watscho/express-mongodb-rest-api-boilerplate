const { authMiddleware: middleware } = require('@app/middleware')
const { userValidator: validator } = require('@app/validator')
const { auth } = require('@app/module')

module.exports = function (router) {
  router.get('/user', middleware.isAuth, auth.user)
  router.post('/sign-in', middleware.isGuest, validator.signIn, auth.signIn)
  router.post('/sign-up', middleware.isGuest, validator.signUp, auth.signUp)
  router.post('/logout', middleware.isAuth, auth.logout)
  router.post(
    '/verify-request',
    middleware.isAuth,
    middleware.isUnverfied,
    auth.verifyRequest
  )
  router.post('/verify', validator.verify, auth.verify)
  router.post(
    '/reset-password',
    middleware.isGuest,
    validator.resetPassword,
    auth.resetPassword
  )
  router.post(
    '/new-password',
    middleware.isGuest,
    validator.newPassword,
    auth.newPassword
  )
  router.post(
    '/change-password',
    middleware.isAuth,
    validator.changePassword,
    auth.changePassword
  )
  router.post(
    '/update-user',
    middleware.isAuth,
    validator.updateUser,
    auth.updateUser
  )
  router.post(
    '/switch-locale',
    middleware.isAuth,
    validator.switchLocale,
    auth.switchLocale
  )
}
