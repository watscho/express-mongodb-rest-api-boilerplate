const crypto = require('crypto-random-string')
const moment = require('moment')

const userService = {
  verifyRequest: async user => {
    const token = crypto({ length: 48, type: 'url-safe' })
    const expiresIn = moment().add(7, 'days')

    user.set({
      account: {
        verification: {
          token,
          expiresIn
        }
      }
    })

    await user.save()

    return token
  }
}

module.exports = userService
