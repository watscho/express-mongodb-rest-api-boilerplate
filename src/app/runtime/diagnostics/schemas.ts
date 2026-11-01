import { z } from 'zod'
import { configurationIssueSchema } from '../../config/schemas.ts'

export const diagnosticSchema = z.object({
  code: z.string(),
  reason: z.string(),
  hint: z.string(),
  errorType: z.string().optional(),
  sourceCode: z.string().optional(),
  issues: z.array(configurationIssueSchema).optional(),
  stack: z.array(z.string()).optional()
})
export const diagnosticContextSchema = z.object({
  component: z.string(),
  stage: z.string().optional(),
  requestId: z.string().optional(),
  method: z.string().optional(),
  route: z.string().optional(),
  status: z.number().optional()
})
