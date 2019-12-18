const validator = require('validator')

class UserValidator {
  async signIn (req, res, next) {
    let { body: { email } } = req
    const { body: { password } } = req

    if (!email) {
      return res.status(400)
        .json({ error: 'Error: email' })
    }

    if (!password) {
      return res.status(400)
        .json({ error: 'Error: password' })
    }

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    return next()
  }

  async signUp (req, res, next) {
    let { body: { email = '' } } = req
    const { body: { password } } = req

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    if (!email || !validator.isEmail(email, { allow_utf8_local_part: false })) {
      return res.status(400)
        .json({ error: 'Error: email' })
    }

    if (!password || !validator.isLength(password, { min: 6 })) {
      return res.status(400)
        .json({ error: 'Error: password' })
    }

    return next()
  }

  async verify (req, res, next) {
    const { body: { token } } = req

    if (!token) {
      return res.status(400)
        .json({ error: 'Error: token' })
    }

    return next()
  }

  async resetPassword (req, res, next) {
    let { body: { email } } = req

    if (!email) {
      return res.status(400)
        .json({ error: 'Error: email' })
    }

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    return next()
  }

  async newPassword (req, res, next) {
    const { body: { token, newPassword } } = req

    if (!token) {
      return res.status(400)
        .json({ error: 'Error: token' })
    }

    if (!newPassword) {
      return res.status(400)
        .json({ error: 'Error: newPassword' })
    }

    if (!validator.isLength(newPassword, { min: 6 })) {
      return res.status(400)
        .json({ error: 'Error: newPassword' })
    }

    return next()
  }

  async changePassword (req, res, next) {
    const { body: { currentPassword, newPassword } } = req

    if (!currentPassword) {
      return res.status(400)
        .json({ error: 'Error: currentPassword' })
    }

    if (!newPassword) {
      return res.status(400)
        .json({ error: 'Error: newPassword' })
    }

    if (!validator.isLength(newPassword, { min: 6 })) {
      return res.status(400)
        .json({ error: 'Error: newPassword' })
    }

    return next()
  }

  async updateUser (req, res, next) {
    let { body: { email = '' } } = req
    const { firstName, lastName } = req

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    if (!email || !validator.isEmail(email, { allow_utf8_local_part: false })) {
      return res.status(400)
        .json({ error: 'Error: email' })
    }

    if (!firstName || !validator.isLength(firstName, { min: 2 })) {
      return res.status(400)
        .json({ error: 'Error: firstName' })
    }

    if (!lastName || !validator.isLength(lastName, { min: 2 })) {
      return res.status(400)
        .json({ error: 'Error: lastName' })
    }

    return next()
  }

  async switchLocale (req, res, next) {
    const { body: { locale }, i18n: { options: { preload: locales } } } = req

    if (!locale || !locales.includes(locale)) {
      return res.status(400)
        .json({ error: 'Error: locale' })
    }

    return next()
  }

  static getInstance () {
    if (!this.instance) {
      this.instance = new this()
    }
    return this.instance
  }
}

module.exports = UserValidator
