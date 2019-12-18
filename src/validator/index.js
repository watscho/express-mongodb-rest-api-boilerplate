const UserValidator = require('@app/validator/userValidator').getInstance()

module.exports = {
  signInValidator: UserValidator.signIn,
  signUpValidator: UserValidator.signUp,
  verifyValidator: UserValidator.verify,
  resetPasswordValidator: UserValidator.resetPassword,
  newPasswordValidator: UserValidator.newPassword,
  changePasswordValidator: UserValidator.changePassword,
  updateUserValidator: UserValidator.updateUser,
  switchLocaleValidator: UserValidator.switchLocale
}
