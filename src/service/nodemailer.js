const path = require('path')
const nodemailer = require('nodemailer')
const Email = require('email-templates')
const i18next = require('i18next')

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  }
})

const mail = new Email({
  views: {
    root: path.join(process.env.NODE_PATH, 'view', 'template'),
    locals: {
      i18n: i18next,
      clientUrl: process.env.CLIENT_URL
    },
    options: { extension: 'ejs' }
  },
  preview: false,
  send: true,
  transport: transporter
})

module.exports = { transporter, mail }
