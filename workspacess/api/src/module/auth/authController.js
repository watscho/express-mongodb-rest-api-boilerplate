const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto-random-string')
const moment = require('moment')
const HttpStatus = require('http-status-codes')

const redis = require('@app/redis')
const { userMail } = require('@app/module/auth/mail')
const { userService } = require('@app/module/auth/service')
const UserModel = require('@app/module/auth/user')

const authController = {
  user: (req, res) => {
    const {
      context: { user }
    } = req

    return res.status(HttpStatus.OK).json({ user })
  },

  signIn: async (req, res) => {
    try {
      const {
        body: { email, password }
      } = req

      const user = await UserModel.emailExist(email)
      if (!user) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'User not found.' })
      }

      const comparePassword = await user.comparePassword(password)
      if (!comparePassword) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Password is incorrect.' })
      }

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
      })

      return res.status(HttpStatus.OK).json({ accessToken })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  signUp: async (req, res) => {
    try {
      const {
        body: { email, password },
        i18n
      } = req

      let user = await UserModel.emailExist(email)
      if (user) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Email has already been taken.' })
      }

      const hash = bcrypt.hashSync(password, 10)

      user = await new UserModel({
        email,
        password: hash,
        locale: i18n.language
      }).save()

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
      })

      const token = await userService.verifyRequest(user)

      userMail.verifyRequest(user, token)

      return res.status(HttpStatus.OK).json({ accessToken })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  logout: async (req, res) => {
    try {
      const {
        context: { user, accessToken }
      } = req

      await redis.set(`expiredToken:${accessToken}`, user._id, 'EX', process.env.REDIS_TOKEN_EXPIRY)

      return res.status(HttpStatus.OK).json({ succeed: true })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  verifyRequest: async (req, res) => {
    try {
      const {
        context: { user }
      } = req

      const token = await userService.verifyRequest(user)

      userMail.verifyRequest(user, token)

      return res.status(HttpStatus.OK).json({ succeed: true })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  verify: async (req, res) => {
    try {
      const {
        body: { token }
      } = req

      const user = await UserModel.findOne({
        'account.verification.token': token
      })
      if (!user) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'Access Token is not valid or has expired.' })
      }

      user.set({
        account: {
          verification: {
            verified: true,
            token: null,
            expiresIn: null
          }
        }
      })

      await user.save()

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
      })

      userMail.verify(user)

      return res.status(HttpStatus.OK).json({ accessToken })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  resetPassword: async (req, res) => {
    try {
      const {
        body: { email }
      } = req

      const user = await UserModel.findOne({ email })
      if (!user) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'User not found.' })
      }

      const token = crypto({ length: 48, type: 'url-safe' })
      const expiresIn = moment().add(7, 'days')

      user.set({
        account: {
          resetPassword: {
            token,
            expiresIn
          }
        }
      })

      await user.save()

      userMail.resetPassword(user, token)

      return res.status(HttpStatus.OK).json({ succeed: true })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  newPassword: async (req, res) => {
    try {
      const {
        body: { token, newPassword }
      } = req

      const user = await UserModel.findOne({
        'account.resetPassword.token': token
      })
      if (!user) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ error: 'Access Token is not valid or has expired.' })
      }

      const hash = bcrypt.hashSync(newPassword, 10)

      user.set({
        password: hash,
        account: {
          resetPassword: {
            token: null,
            expiresIn: null
          }
        }
      })

      await user.save()

      const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
      })

      return res.status(HttpStatus.OK).json({ accessToken })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  changePassword: async (req, res) => {
    try {
      const {
        body: { currentPassword, newPassword },
        context: { user }
      } = req

      const comparePassword = await user.comparePassword(currentPassword)
      if (!comparePassword) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Current password is incorrect.' })
      }

      const hash = bcrypt.hashSync(newPassword, 10)

      user.set({ password: hash })

      await user.save()

      return res.status(HttpStatus.OK).json({ succeed: true })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  updateUser: async (req, res) => {
    try {
      const {
        body: { email, firstName, lastName },
        context: { user }
      } = req

      let {
          account: {
            verification: { verified }
          }
        } = user,
        verifyRequest = false

      if (user.email !== email) {
        const userExist = await UserModel.findOne({ email })
        if (userExist) {
          return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Email has already been taken.' })
        }
        verified = false
        verifyRequest = true
      }

      user.set({
        email,
        firstName,
        lastName,
        account: {
          verification: {
            verified
          }
        }
      })

      await user.save()

      if (verifyRequest) {
        const token = await userService.verifyRequest(user)

        userMail.verifyRequest(user, token)
      }

      return res.status(HttpStatus.OK).json({ user })
    } catch (error) {
      return Promise.reject(error)
    }
  },

  switchLocale: async (req, res) => {
    try {
      const {
        body: { locale },
        context: { user }
      } = req

      user.set({ locale })

      await user.save()

      return res.status(HttpStatus.OK).json({ user })
    } catch (error) {
      return Promise.reject(error)
    }
  }
}

module.exports = authController
