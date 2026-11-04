import { dictionary } from '@zxcvbn-ts/language-common'

// Offline common-password screening: no password or hash is sent to a third party.
const common = new Set(
  dictionary['passwords-common'].map(value =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '')
  )
)
export const isCommonPassword = (password: string): boolean => {
  const normalized = password
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
  return (
    (normalized.length > 0 && common.has(normalized)) ||
    /^(.{1,4})\1+$/u.test(password.normalize('NFKC').toLowerCase()) ||
    /^(.{1,4})\1+$/u.test(normalized)
  )
}
