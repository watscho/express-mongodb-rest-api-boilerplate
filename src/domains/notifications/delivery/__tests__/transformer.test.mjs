import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toDeliveryDto,
  toClaimedEmailDto
} from '../../../../../dist/domains/notifications/delivery/transformer.js'

test('delivery DTO omits encrypted payload and normalizes dates', () => {
  const date = new Date()
  const row = {
    _id: 'job',
    status: 'sent',
    template: 'signUp',
    attempts: 1,
    maxAttempts: 8,
    availableAt: date,
    expiresAt: date,
    createdAt: date,
    updatedAt: date,
    completedAt: date,
    payload: 'secret',
    fingerprint: 'private',
    lastErrorCode: 'smtp.temporary'
  }
  const dto = toDeliveryDto(row)
  assert(!('payload' in dto))
  assert(!('fingerprint' in dto))
  assert.equal(dto.completedAt, date.toISOString())
  assert.equal(toClaimedEmailDto(row, 'lease').leaseToken, 'lease')
})
test('claimed payload missing becomes undefined', () => {
  assert.equal(
    toClaimedEmailDto({ _id: 'job', payload: null }, 'lease').payload,
    undefined
  )
})
