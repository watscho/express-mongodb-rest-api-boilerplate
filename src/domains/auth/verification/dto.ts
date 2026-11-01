import type { z } from 'zod'
import type {
  verificationTokenSchema,
  issueVerificationTokenSchema
} from './schemas.ts'

export type VerificationTokenDto = z.infer<typeof verificationTokenSchema>
export type IssueVerificationTokenDto = z.infer<
  typeof issueVerificationTokenSchema
>
