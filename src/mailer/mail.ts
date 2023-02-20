import path from 'path'
import nodemailer, { Transporter } from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import Email from 'email-templates'
import i18next from 'i18next'

export abstract class Mailer {
  private transporter: Transporter<SMTPTransport.SentMessageInfo>

  protected mailer: Email

  constructor() {
    this.createTransporter()

    this.initializeMailer()
  }

  private initializeMailer() {
    this.mailer = new Email({
      views: {
        root: path.join(__dirname, '..', process.env.MAIL_TPL_PATH),
        locals: {
          origin: process.env.ORIGIN,
          t: i18next.t
        },
        options: { extension: 'ejs' }
      },
      preview: false,
      send: true,
      transport: this.transporter
    })
  }

  private createTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
      }
    })
  }
}
