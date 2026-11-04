import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encryptDelivery,
  decryptDelivery,
  fingerprintDelivery
} from '../../../../../dist/domains/notifications/delivery/utils.js'

const notification = {
  email: 'unit@example.test',
  template: 'signUp',
  language: 'en',
  variables: {}
}

test('encrypted outbox binds payload to job id and uses random IV', () => {
  const payload = encryptDelivery('job', notification)
  assert.deepEqual(decryptDelivery('job', payload), notification)
  assert.notEqual(payload, encryptDelivery('job', notification))
  assert(!payload.includes(notification.email))
  assert.throws(() => decryptDelivery('another', payload))
  const parts = payload.split('.')
  parts[2] = 'A'.repeat(22)
  assert.throws(() => decryptDelivery('job', parts.join('.')))
})

for (const value of ['', 'v2.a.b.c', 'v1.a.b.c', 'secret'])
  test(`reject malformed encrypted payload ${value}`, () =>
    assert.throws(() => decryptDelivery('job', value)))

test('oversized payload rejected before encryption', () =>
  assert.throws(
    () =>
      encryptDelivery('job', {
        ...notification,
        variables: { large: 'x'.repeat(256 * 1024) }
      }),
    { messageKey: 'notifications.payload_too_large' }
  ))

test('fingerprint canonicalizes nested object keys but preserves array order', () => {
  assert.equal(
    fingerprintDelivery({ b: 2, a: { y: 2, x: 1 } }),
    fingerprintDelivery({ a: { x: 1, y: 2 }, b: 2 })
  )
  assert.notEqual(fingerprintDelivery([1, 2]), fingerprintDelivery([2, 1]))
})
test('fingerprinting preserves null scalar values', () =>
  assert.equal(fingerprintDelivery(null), fingerprintDelivery(null)))
