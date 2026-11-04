import { queueEnv } from '../../../app/config/queue.ts'
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes
} from 'node:crypto'
import { AppError } from '../../../app/http/errors.ts'
import type { PreparedNotificationDto } from '../dto.ts'

const encryptionKey = Buffer.from(queueEnv.MAIL_QUEUE_ENCRYPTION_KEY, 'hex')

export const fingerprintDelivery = (input: unknown): string =>
  createHmac('sha256', encryptionKey)
    .update(
      JSON.stringify(input, (_key, value: unknown) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([left], [right]) =>
                left < right ? -1 : 1
              )
            )
          : value
      )
    )
    .digest('hex')

export const encryptDelivery = (
  id: string,
  notification: PreparedNotificationDto
): string => {
  const plaintext = JSON.stringify(notification)
  if (Buffer.byteLength(plaintext) > 256 * 1024) {
    throw new AppError(400, 'notifications.payload_too_large')
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  cipher.setAAD(Buffer.from(id))
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.')
}

// Return unknown: the worker validates the decrypted JSON at its consumer boundary.
export const decryptDelivery = (id: string, payload: string): unknown => {
  const match =
    /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]+)$/.exec(
      payload
    )
  if (!match?.[1] || !match[2] || !match[3])
    throw new Error('Invalid encrypted email payload')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    Buffer.from(match[1], 'base64url')
  )
  decipher.setAAD(Buffer.from(id))
  decipher.setAuthTag(Buffer.from(match[2], 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(match[3], 'base64url')),
    decipher.final()
  ])
  return JSON.parse(plaintext.toString('utf8')) as unknown
}
