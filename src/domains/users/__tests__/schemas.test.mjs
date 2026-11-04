import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as users from '../../../../dist/domains/users/schemas.js'

test('email normalizes but retains provider aliases', () =>
  assert.equal(
    users.emailSchema.parse(' Test+alias@EXAMPLE.COM '),
    'test+alias@example.com'
  ))

test('profile trims names and removes unknown fields', () =>
  assert.deepEqual(
    users.updateProfileSchema.parse({
      firstName: '  Test ',
      lastName: ' User ',
      admin: true
    }),
    { firstName: 'Test', lastName: 'User' }
  ))
