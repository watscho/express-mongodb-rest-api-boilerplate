const jwt = require('jsonwebtoken')

const redis = require('@app/redis')
const UserModel = require('@app/module/auth/user')

const authentication = async (req, res, next) => {
  try {
    Object.assign(req, { context: {} })

    const { headers: { authorization } } = req
    if (!authorization) {
      return next()
    }

    const accessToken = authorization.split(' ')[1]

    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET)
    if (!decoded) {
      return next()
    }

    const isExpired = await redis.get(`expiredToken:${accessToken}`)
    if (isExpired) {
      return next()
    }

    const user = await UserModel.findById(decoded.userId)
    if (!user) {
      return next()
    }

    Object.assign(req, {
      context: {
        user,
        accessToken
      }
    })

    return next()
  } catch (error) {
    return next()
  }
}

module.exports = authentication
