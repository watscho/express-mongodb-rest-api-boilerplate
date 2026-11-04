import { z } from 'zod'
import { isCommonPassword } from './password-policy.ts'
import { accountSchema, emailSchema, objectIdSchema } from '../users/schemas.ts'

export const currentPasswordSchema = z.string().min(1).max(1024)
export const passwordSchema = z
  .string()
  .min(15)
  .max(72)
  .refine(value => Array.from(value).length >= 15, {
    message: 'auth.password_too_short',
    params: { min: 15 }
  })
  .refine(value => !isCommonPassword(value), {
    message: 'auth.password_common'
  })
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'auth.password_max_bytes',
    params: { max: 72 }
  })
export const credentialsSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema
})
export const emailRequestSchema = credentialsSchema.pick({ email: true })
export const signUpSchema = emailRequestSchema.extend({
  password: passwordSchema
})
export const newPasswordSchema = signUpSchema.pick({ password: true })
export const updatePasswordSchema = z.object({
  oldPassword: currentPasswordSchema,
  newPassword: passwordSchema
})
export const deleteProfileSchema = credentialsSchema.pick({ password: true })
export const tokenParamsSchema = z.object({
  accessToken: z
    .string()
    .regex(/^[a-f\d]{96}$/i)
    .describe(
      'Single-use email token, distinct from a bearer JWT. Never log or store it in analytics.'
    )
})
export const accessTokenSchema = z.object({ accessToken: z.string().min(1) })
export const updateEmailResponseSchema = emailRequestSchema.extend({
  accessToken: z.string().optional()
})
export const tokenClaimsSchema = z.object({
  sub: objectIdSchema,
  version: accountSchema.shape.authVersion,
  exp: z.number().int().positive()
})
export const authContextSchema = z.object({
  user: accountSchema,
  accessToken: z.string(),
  expiresAt: tokenClaimsSchema.shape.exp
})
export const emailTokenSchema = tokenParamsSchema.extend({
  expiresIn: z.date()
})
export const issueResetTokenSchema = emailTokenSchema.extend({
  userId: objectIdSchema
})
export const resetTokenSchema = issueResetTokenSchema.omit({
  accessToken: true
})
