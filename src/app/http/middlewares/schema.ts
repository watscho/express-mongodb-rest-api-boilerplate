import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { AppError } from '../errors.ts'
import { toValidationIssueDto } from '../transformer.ts'

export const validateRequest =
  (schema: z.ZodType, source: 'body' | 'params' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      throw new AppError(
        400,
        'validation.failed',
        result.error.issues.map(toValidationIssueDto)
      )
    }
    if (source === 'body') req.body = result.data
    next()
  }
