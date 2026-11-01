import 'dotenv/config'
import { readFileSync } from 'node:fs'
import type { z } from 'zod'
import type { ConfigurationIssueDto } from './dto.ts'
import { ConfigurationError } from './errors.ts'

const requirements: Readonly<Record<string, string>> = {
  MONGODB_URI: 'Use a valid mongodb:// or mongodb+srv:// connection string.',
  REDIS_URI: 'Use a valid redis:// or rediss:// connection URL.',
  JWT_SECRET: 'Use a secret with at least 32 characters.',
  JWT_EXPIRATION:
    'Use a positive duration such as 24h; it must resolve to at least one whole second.',
  MAIL_QUEUE_ENCRYPTION_KEY:
    'Use exactly 64 hexadecimal characters (32 bytes).',
  APP_URL:
    'Use an HTTP(S) URL without credentials, query parameters, or a fragment.',
  CLIENT_URL:
    'Use an HTTP(S) URL without credentials, query parameters, or a fragment.',
  MONGODB_MIN_POOL_SIZE: 'Must not exceed MONGODB_MAX_POOL_SIZE.',
  DOCS_PASSWORD:
    'Set DOCS_USERNAME and DOCS_PASSWORD together; enabled production docs require both.',
  DOCS_USERNAME: 'Use 1–128 characters without colons or line breaks.',
  MAIL_USER: 'Set MAIL_USER and MAIL_PASSWORD together.',
  MAIL_RETRY_MAX_DELAY_MS: 'Must be at least MAIL_RETRY_BASE_DELAY_MS.',
  MAIL_WORKER_STALE_MS:
    'Must cover at least three MAIL_WORKER_HEARTBEAT_MS intervals.'
}

const describeIssue = (
  issue: z.core.$ZodIssue,
  input: Record<string, string | undefined>
): ConfigurationIssueDto => {
  const field = issue.path.join('.') || 'environment'
  if (input[String(issue.path[0])] === undefined && issue.code !== 'custom') {
    return {
      field,
      code: 'required',
      reason: `Required setting is missing.${requirements[field] ? ` ${requirements[field]}` : ''}`
    }
  }
  let reason = 'Value does not satisfy the setting requirements.'
  if (issue.code === 'too_small' || issue.code === 'too_big') {
    const small = issue.code === 'too_small'
    const boundary = small ? issue.minimum : issue.maximum
    const comparison = small
      ? issue.inclusive
        ? 'at least'
        : 'greater than'
      : issue.inclusive
        ? 'at most'
        : 'less than'
    reason = `Must be ${comparison} ${String(boundary)}${issue.origin === 'string' ? ' characters' : ''}.`
  } else if (issue.code === 'invalid_type') {
    reason = 'Value has the wrong type; check the documented setting format.'
  } else if (issue.code === 'invalid_value') {
    reason = `Use one of: ${issue.values.map(value => String(value)).join(', ')}.`
  } else if (issue.code === 'invalid_format' || issue.code === 'custom') {
    reason =
      requirements[field] ??
      'Value has an invalid format or conflicts with related settings.'
  }
  return { field, code: issue.code, reason }
}

// Parse only the settings needed by the importing process/module.
export const loadEnvironment = <Schema extends z.ZodType>(
  schema: Schema,
  secretKeys: readonly string[] = []
): Readonly<z.output<Schema>> => {
  const input: Record<string, string | undefined> = { ...process.env }
  const issues: ConfigurationIssueDto[] = []
  for (const key of secretKeys) {
    const file = input[`${key}_FILE`]
    if (!file) continue
    if (input[key]) {
      issues.push({
        field: key,
        code: 'secret_conflict',
        reason: `Set either ${key} or ${key}_FILE, not both.`
      })
      continue
    }
    try {
      const value = readFileSync(file, 'utf8').trimEnd()
      if (!value) {
        issues.push({
          field: key,
          code: 'secret_empty',
          reason: `The ${key}_FILE secret is empty.`
        })
        continue
      }
      input[key] = value
    } catch {
      issues.push({
        field: key,
        code: 'secret_unreadable',
        reason: `Cannot read ${key}_FILE; check its existence, mount, and process read permissions.`
      })
    }
  }
  const result = schema.safeParse(input)
  if (!result.success) {
    // Never include rejected values, filesystem paths, or secret-bearing error messages.
    issues.push(
      ...result.error.issues
        .filter(
          issue =>
            !issues.some(existing => existing.field === issue.path.join('.'))
        )
        .map(issue => describeIssue(issue, input))
    )
  }
  if (!result.success || issues.length) throw new ConfigurationError(issues)
  return Object.freeze(result.data)
}
