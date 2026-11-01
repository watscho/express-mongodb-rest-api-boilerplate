import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i)
// Account identity normalization deliberately preserves provider-specific aliases.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email())
const nameSchema = z.string().trim().min(2).max(48)

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema
})

export const accountSchema = z.object({
  id: objectIdSchema,
  email: emailSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  verified: z.boolean(),
  authVersion: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date()
})
export const accountCredentialsSchema = accountSchema.extend({
  password: z.string()
})
export const createAccountSchema = accountCredentialsSchema.pick({
  email: true,
  password: true
})
export const userResponseSchema = accountSchema
  .omit({ id: true, authVersion: true })
  .extend({
    _id: objectIdSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    image: z.url().optional()
  })
