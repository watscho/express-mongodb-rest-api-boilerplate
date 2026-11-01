import type { z } from 'zod'
import type { diagnosticContextSchema, diagnosticSchema } from './schemas.ts'

export type DiagnosticDto = z.infer<typeof diagnosticSchema>
export type DiagnosticContextDto = z.infer<typeof diagnosticContextSchema>
