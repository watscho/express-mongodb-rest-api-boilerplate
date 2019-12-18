const HttpStatus = require('http-status-codes')

class AuthMiddleware {
  async isAuth (req, res, next) {
    const { context: { user } } = req

    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'You must be authorized.' })
    }

    return next()
  }

  async isGuest (req, res, next) {
    const { context: { user } } = req

    if (user) {
      return res.status(HttpStatus.FORBIDDEN)
        .json({ error: 'You have already authorized.' })
    }

    return next()
  }

  async isVerified (req, res, next) {
    const { context: { user: { account: { verification: { verified } } } } } = req

    if (!verified) {
      return res.status(HttpStatus.FORBIDDEN)
        .json({ error: 'You must be verified.' })
    }

    return next()
  }

  async isUnverfied (req, res, next) {
    const { context: { user: { account: { verification: { verified } } } } } = req

    if (verified) {
      return res.status(HttpStatus.FORBIDDEN)
        .json({ error: 'You have already verified.' })
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

module.exports = AuthMiddleware
