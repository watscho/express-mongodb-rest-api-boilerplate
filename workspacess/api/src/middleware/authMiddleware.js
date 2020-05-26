const HttpStatus = require('http-status-codes')

const authMiddleware = {
  isAuth: async (req, res, next) => {
    const {
      context: { user }
    } = req

    if (!user) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'You must be authorized.' })
    }

    return next()
  },

  isGuest: async (req, res, next) => {
    const {
      context: { user }
    } = req

    if (user) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ error: 'You have already authorized.' })
    }

    return next()
  },

  isVerified: async (req, res, next) => {
    const {
      context: {
        user: {
          account: {
            verification: { verified }
          }
        }
      }
    } = req

    if (!verified) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ error: 'You must be verified.' })
    }

    return next()
  },

  isUnverfied: async (req, res, next) => {
    const {
      context: {
        user: {
          account: {
            verification: { verified }
          }
        }
      }
    } = req

    if (verified) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ error: 'You have already verified.' })
    }

    return next()
  }
}

module.exports = authMiddleware
