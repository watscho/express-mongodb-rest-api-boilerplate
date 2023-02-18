import { randomBytes } from 'crypto'

export const createCryptoString = ({ length = 48 }: { length?: number } = {}) =>
  randomBytes(length).toString('hex')
