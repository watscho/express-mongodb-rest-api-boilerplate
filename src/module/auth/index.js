const AuthController = require('@app/module/auth/authController').getInstance()

module.exports = {
  user: AuthController.user,
  signIn: AuthController.signIn,
  signUp: AuthController.signUp,
  logout: AuthController.logout,
  verifyRequest: AuthController.verifyRequest,
  verify: AuthController.verify,
  resetPassword: AuthController.resetPassword,
  newPassword: AuthController.newPassword,
  changePassword: AuthController.changePassword,
  updateUser: AuthController.updateUser,
  switchLocale: AuthController.switchLocale
}
