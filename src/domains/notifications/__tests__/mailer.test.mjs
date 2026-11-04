import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifySmtpFailure } from '../../../../dist/domains/notifications/mailer.js'

for (const [props, code, retryable] of [
  [{}, 'smtp.connection', true],
  [{ responseCode: 421 }, 'smtp.temporary', true],
  [{ responseCode: 503 }, 'smtp.temporary', true],
  [{ responseCode: 550 }, 'smtp.permanent', false],
  [{ code: 'EAUTH' }, 'smtp.configuration', false],
  [{ code: 'ETLS' }, 'smtp.configuration', false],
  [{ code: 'EENVELOPE' }, 'smtp.permanent', false],
  [{ permanent: true }, 'smtp.permanent', false],
  [{ permanent: false, code: 'EAUTH' }, 'smtp.temporary', true]
])
  test(`SMTP classification ${JSON.stringify(props)}`, () =>
    assert.deepEqual(
      classifySmtpFailure(Object.assign(new Error('sensitive'), props)),
      { code, retryable }
    ))

test('untrusted non-Error SMTP value is treated as connection failure', () =>
  assert.equal(
    classifySmtpFailure({ responseCode: 550 }).code,
    'smtp.connection'
  ))
test('non-error SMTP values do not become permanent failures and lower response codes remain retryable', () => {
  assert.deepEqual(
    classifySmtpFailure(Object.assign(Error('smtp'), { responseCode: 300 })),
    { code: 'smtp.temporary', retryable: true }
  )
})
