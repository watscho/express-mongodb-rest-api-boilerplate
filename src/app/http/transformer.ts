import type { ZodIssue } from 'zod'
import { messageKeySchema } from './schemas.ts'
import type {
  MessageKeyDto,
  MessageParamsDto,
  ValidationIssueDto
} from './dto.ts'

// Return stable keys and constraints, never Zod's English text or rejected input.
export const toValidationIssueDto = (issue: ZodIssue): ValidationIssueDto => {
  let messageKey: MessageKeyDto = `validation.${issue.code}`
  const params: MessageParamsDto = {}
  if (issue.code === 'custom') {
    const custom = messageKeySchema.safeParse(issue.message)
    if (custom.success) messageKey = custom.data
    for (const [key, value] of Object.entries(issue.params ?? {})) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      )
        params[key] = value
    }
  }
  if ('minimum' in issue)
    params.min =
      typeof issue.minimum === 'bigint' ? String(issue.minimum) : issue.minimum
  if ('maximum' in issue)
    params.max =
      typeof issue.maximum === 'bigint' ? String(issue.maximum) : issue.maximum
  if ('inclusive' in issue && typeof issue.inclusive === 'boolean')
    params.inclusive = issue.inclusive
  if ('expected' in issue && typeof issue.expected === 'string')
    params.expected = issue.expected
  if ('format' in issue && typeof issue.format === 'string')
    params.format = issue.format
  if ('origin' in issue && typeof issue.origin === 'string')
    params.origin = issue.origin
  return {
    path: issue.path.join('.'),
    messageKey,
    ...(Object.keys(params).length ? { params } : {})
  }
}
