import nodemailer, { Transporter } from 'nodemailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import Email from 'email-templates'
import i18next from 'i18next'

import { joinRelativeToMainPath } from '@/utils/paths'

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
        root: joinRelativeToMainPath(process.env.MAIL_TPL_PATH),
        locals: {
          clientUrl: process.env.CLIENT_URL,
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
