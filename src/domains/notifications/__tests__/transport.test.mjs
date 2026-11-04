import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { replace } from '../../../__tests__/helpers.mjs'
const options = [],
  transport = {
    sendMail: mock.fn(async () => ({ accepted: ['unit@example.test'] })),
    close: mock.fn()
  }
mock.module('nodemailer', {
  exports: {
    default: {
      createTransport: input => {
        options.push(input)
        return transport
      }
    }
  }
})
const env = {
  MAIL_HOST: 'smtp.unit',
  MAIL_PORT: 1025,
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_WORKER_CONCURRENCY: 2
}
replace('app/config/mail.js', { mailEnv: env })
const { sendMail, closeMailTransport } =
  await import('../../../../dist/domains/notifications/mailer.js')
test('SMTP transport is lazy pooled safe and reused until close', async () => {
  closeMailTransport()
  assert.equal(options.length, 0)
  await sendMail({ to: 'unit@example.test' })
  await sendMail({ to: 'unit@example.test' })
  assert.equal(options.length, 1)
  assert.equal(options[0].disableFileAccess, true)
  assert.equal(options[0].disableUrlAccess, true)
  assert(!('auth' in options[0]))
  closeMailTransport()
  assert.equal(transport.close.mock.callCount(), 1)
  env.MAIL_USER = 'user'
  env.MAIL_PASSWORD = 'password'
  await sendMail({})
  assert.deepEqual(options[1].auth, { user: 'user', pass: 'password' })
  closeMailTransport()
})
