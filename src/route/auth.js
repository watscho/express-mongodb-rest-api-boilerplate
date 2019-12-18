const { isAuth, isGuest, isUnverfied /* isVerified */ } = require('@app/middleware')
const {
  signInValidator,
  signUpValidator,
  verifyValidator,
  resetPasswordValidator,
  newPasswordValidator,
  changePasswordValidator,
  updateUserValidator,
  switchLocaleValidator
} = require('@app/validator')
const { auth } = require('@app/module')

module.exports = function (router) {
  router.get('/user', isAuth, auth.user)
  router.post('/sign-in', isGuest, signInValidator, auth.signIn)
  router.post('/sign-up', isGuest, signUpValidator, auth.signUp)
  router.post('/logout', isAuth, auth.logout)
  router.post('/verify-request', isAuth, isUnverfied, auth.verifyRequest)
  router.post('/verify', verifyValidator, auth.verify)
  router.post('/reset-password', isGuest, resetPasswordValidator, auth.resetPassword)
  router.post('/new-password', isGuest, newPasswordValidator, auth.newPassword)
  router.post('/change-password', isAuth, changePasswordValidator, auth.changePassword)
  router.post('/update-user', isAuth, updateUserValidator, auth.updateUser)
  router.post('/switch-locale', isAuth, switchLocaleValidator, auth.switchLocale)
}