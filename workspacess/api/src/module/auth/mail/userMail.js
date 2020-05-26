const winston = require('winston')

const { mail } = require('@app/service/nodemailer')

const userMail = {
  verifyRequest: (user, token) => {
    mail
      .send({
        template: 'verify-request',
        message: {
          from: '"Verification request" <no-replay@example.com>',
          to: user.email,
          subject: 'Verification request'
        },
        locals: {
          locale: user.locale,
          token
        }
      })
      .catch(error => winston.error(error))
  },

  verify: user => {
    mail
      .send({
        template: 'verify',
        message: {
          from: '"Verification" <no-replay@example.com>',
          to: user.email,
          subject: 'Verification'
        },
        locals: { locale: user.locale }
      })
      .catch(error => winston.error(error))
  },

  resetPassword: (user, token) => {
    mail
      .send({
        template: 'reset-password',
        message: {
          from: '"Reset Password" <no-replay@example.com>',
          to: user.email,
          subject: 'Reset Password'
        },
        locals: {
          locale: user.locale,
          token
        }
      })
      .catch(error => winston.error(error))
  }
}

module.exports = userMail
