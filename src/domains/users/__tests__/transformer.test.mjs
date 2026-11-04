import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toAccountDto,
  toAccountCredentialsDto,
  toUserResponseDto
} from '../../../../dist/domains/users/transformer.js'

test('account transformations omit persistence and credential details', () => {
  const date = new Date('2026-01-01')
  const row = {
    _id: { toString: () => 'a'.repeat(24) },
    email: 'u@example.test',
    authVersion: 2,
    password: 'hash',
    verified: null,
    firstName: null,
    lastName: null,
    createdAt: date,
    updatedAt: date
  }
  const account = toAccountDto(row)
  assert.equal(account.verified, false)
  assert.equal(account.id, 'a'.repeat(24))
  assert.equal(toAccountCredentialsDto(row).password, 'hash')
  const result = toUserResponseDto(
    { ...account, password: 'secret' },
    'http://example.com/avatar'
  )
  assert.equal(result.image, 'http://example.com/avatar')
  assert.equal(result.createdAt, date.toISOString())
  for (const k of ['password', 'authVersion', 'id']) assert(!(k in result))
  assert(!('image' in toUserResponseDto(account)))
})
