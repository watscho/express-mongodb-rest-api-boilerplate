import { emailSchema } from '../../users/schemas.ts'
import { resetTokenSchema, tokenParamsSchema } from '../schemas.ts'

export const verificationTokenSchema = resetTokenSchema.extend({
  email: emailSchema
})
export const issueVerificationTokenSchema = verificationTokenSchema.extend({
  accessToken: tokenParamsSchema.shape.accessToken
})
