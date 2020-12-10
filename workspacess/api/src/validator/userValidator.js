const validator = require('validator')
const HttpStatus = require('http-status-codes')

const userValidator = {
  signIn: async (req, res, next) => {
    let {
      body: { email }
    } = req
    const {
      body: { password }
    } = req

    if (!email) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: email' })
    }

    if (!password) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: password' })
    }

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    return next()
  },

  signUp: async (req, res, next) => {
    let {
      body: { email = '' }
    } = req
    const {
      body: { password }
    } = req

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    if (!email || !validator.isEmail(email, { allow_utf8_local_part: false })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: email' })
    }

    if (!password || !validator.isLength(password, { min: 6 })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: password' })
    }

    return next()
  },

  verify: async (req, res, next) => {
    const {
      body: { token }
    } = req

    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: token' })
    }

    return next()
  },

  resetPassword: async (req, res, next) => {
    let {
      body: { email }
    } = req

    if (!email) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: email' })
    }

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    return next()
  },

  newPassword: async (req, res, next) => {
    const {
      body: { token, newPassword }
    } = req

    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: token' })
    }

    if (!newPassword || !validator.isLength(newPassword, { min: 6 })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: newPassword' })
    }

    return next()
  },

  changePassword: async (req, res, next) => {
    const {
      body: { currentPassword, newPassword }
    } = req

    if (!currentPassword) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: currentPassword' })
    }

    if (!newPassword || !validator.isLength(newPassword, { min: 6 })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: newPassword' })
    }

    return next()
  },

  updateUser: async (req, res, next) => {
    let {
      body: { email = '' }
    } = req
    const { firstName, lastName } = req

    email = validator.normalizeEmail(email)
    email = validator.trim(email)

    Object.assign(req.body, { email })

    if (!email || !validator.isEmail(email, { allow_utf8_local_part: false })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: email' })
    }

    if (!firstName || !validator.isLength(firstName, { min: 2 })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: firstName' })
    }

    if (!lastName || !validator.isLength(lastName, { min: 2 })) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: lastName' })
    }

    return next()
  },

  switchLocale: async (req, res, next) => {
    const {
      body: { locale },
      i18n: {
        options: { preload: locales }
      }
    } = req

    if (!locale || !locales.includes(locale)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Error: locale' })
    }

    return next()
  }
}

module.exports = userValidator
