import nodemailer from 'nodemailer'
import { mailEnv as env } from '../../app/config/mail.ts'
import type { MailMessageDto } from './dto.ts'
import type { SmtpFailureDto } from './delivery/dto.ts'

export const classifySmtpFailure = (error: unknown): SmtpFailureDto => {
  const transportCode =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined
  const responseCode =
    error instanceof Error &&
    'responseCode' in error &&
    typeof error.responseCode === 'number'
      ? error.responseCode
      : undefined
  const permanent =
    error instanceof Error &&
    'permanent' in error &&
    typeof error.permanent === 'boolean'
      ? error.permanent
      : undefined
  let code: SmtpFailureDto['code']
  if (
    permanent === false ||
    (responseCode !== undefined &&
      ((responseCode >= 400 && responseCode < 500) || responseCode === 503))
  ) {
    code = 'smtp.temporary'
  } else if (
    transportCode &&
    ['EAUTH', 'ENOAUTH', 'EOAUTH2', 'ECONFIG', 'ETLS', 'EREQUIRETLS'].includes(
      transportCode
    )
  ) {
    code = 'smtp.configuration'
  } else if (permanent === true) {
    code = 'smtp.permanent'
  } else if (responseCode !== undefined) {
    code = responseCode >= 500 ? 'smtp.permanent' : 'smtp.temporary'
  } else if (
    transportCode &&
    ['EENVELOPE', 'EMAXRECIPIENTS', 'EOTP'].includes(transportCode)
  ) {
    code = 'smtp.permanent'
  } else {
    code = 'smtp.connection'
  }
  return {
    code,
    retryable: code === 'smtp.temporary' || code === 'smtp.connection'
  }
}

const createMailTransport = () => {
  const options = {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    requireTLS: env.MAIL_REQUIRE_TLS,
    pool: true as const,
    maxConnections: env.MAIL_WORKER_CONCURRENCY,
    // The persistent outbox owns retries, not the transport's in-memory queue.
    maxRequeues: 0,
    disableFileAccess: true,
    disableUrlAccess: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    ...(env.MAIL_USER
      ? { auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } }
      : {})
  }
  return nodemailer.createTransport(options)
}

// API processes may import the domain without creating a transport.
let mailTransport: ReturnType<typeof createMailTransport> | undefined
export const sendMail = (message: MailMessageDto) => {
  mailTransport ??= createMailTransport()
  return mailTransport.sendMail(message)
}
export const closeMailTransport = () => {
  mailTransport?.close()
  mailTransport = undefined
}
