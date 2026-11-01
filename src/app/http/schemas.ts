import { z } from 'zod'

export const messageKeySchema = z
  .templateLiteral([z.string().min(1), '.', z.string().min(1)])
  .refine(value => /^[a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/.test(value))
export const messageParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
)
export const responseMetadataSchema = z.object({
  messageKey: messageKeySchema,
  status: z.number().int().min(100).max(599)
})
export const validationIssueSchema = z.object({
  path: z.string(),
  messageKey: messageKeySchema,
  params: messageParamsSchema.optional()
})
export const errorResponseSchema = responseMetadataSchema.extend({
  details: z.array(validationIssueSchema).optional()
})
export const livenessResponseSchema = z.object({ status: z.literal('ok') })
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'unavailable'])
})
