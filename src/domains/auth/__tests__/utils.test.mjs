import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmailToken,
  hashToken,
  hashPassword,
  jwtSign,
  jwtVerify
} from '../../../../dist/domains/auth/utils.js'
import jwt from 'jsonwebtoken'
import { compare } from 'bcrypt'

test('email tokens have entropy, fixed length, lifetime and SHA256 hashes', () => {
  const before = Date.now()
  const a = createEmailToken(1)
  assert.match(a.accessToken, /^[a-f0-9]{96}$/)
  assert.notEqual(a.accessToken, createEmailToken(1).accessToken)
  assert(a.expiresIn.getTime() >= before + 86400000)
  assert.equal(
    hashToken('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
})

test('password hashes are salted and verifiable', async () => {
  const hash = await hashPassword('secret')
  assert(await compare('secret', hash))
  assert(!(await compare('wrong', hash)))
  assert.notEqual(hash, await hashPassword('secret'))
})

test('JWT roundtrip, unique jti, issuer audience algorithm signature and expiry', () => {
  const user = { id: 'a'.repeat(24), authVersion: 3 }
  const a = jwtSign(user).accessToken
  assert.notEqual(a, jwtSign(user).accessToken)
  assert.equal(jwtVerify(a).version, 3)
  assert.equal(jwtVerify(a).sub, user.id)
  for (const opts of [
    { issuer: 'wrong' },
    { audience: 'wrong' },
    { algorithm: 'HS384' },
    { expiresIn: -1 }
  ]) {
    const token = jwt.sign({ version: 3 }, process.env.JWT_SECRET, {
      subject: user.id,
      issuer: 'express-mongodb-api',
      audience: 'express-mongodb-client',
      ...opts
    })
    assert.throws(() => jwtVerify(token))
  }
  assert.throws(() => jwtVerify(a.slice(0, -8) + 'invalid'))
  assert.throws(() =>
    jwtVerify(
      jwt.sign({ version: -1 }, process.env.JWT_SECRET, {
        subject: user.id,
        issuer: 'express-mongodb-api',
        audience: 'express-mongodb-client',
        expiresIn: 60
      })
    )
  )
})
