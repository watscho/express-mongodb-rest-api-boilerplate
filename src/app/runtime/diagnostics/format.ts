const sensitiveKey =
  /^(?:authorization|cookie|set-cookie|password|passwordHash|secret|clientSecret|key|apiKey|privateKey|token|accessToken|refreshToken|leaseToken|payload|fingerprint|email|recipient|recipients|body|variables|translations|html|text|subject|headers|url|originalUrl|baseUrl|connectionString)$|(?:_PASSWORD|_SECRET|_TOKEN|_KEY|_URI)$/i

const safeText = (value: string): string =>
  value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\b([a-z][a-z\d+.-]*:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(
      /([?&](?:token|access_?token|password|secret|key|code|email)=)[^&#\s]+/gi,
      '$1[redacted]'
    )
    .replace(
      /(\/(?:auth\/password\/new|user\/verification)\/)(?!:|request(?:\s|$|[/?#]))[^\s/?#]+/gi,
      '$1[redacted]'
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .slice(0, 2000)

export const sanitizeLogValue = (
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): unknown => {
  if (typeof value === 'string') return safeText(value)
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === undefined
  )
    return value
  if (typeof value === 'bigint') return String(value)
  if (typeof value !== 'object') return '[unsupported]'
  if (value instanceof Error)
    return {
      errorType: 'Error',
      reason: 'Use errorDiagnostic for safe exception details.'
    }
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? '[invalid date]'
      : value.toISOString()
  if (depth >= 6 || seen.has(value)) return '[omitted]'
  seen.add(value)
  if (Array.isArray(value))
    return value
      .slice(0, 200)
      .map(item => sanitizeLogValue(item, seen, depth + 1))
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 50)
      .map(([key, item]) => [
        safeText(key),
        sensitiveKey.test(key)
          ? '[redacted]'
          : sanitizeLogValue(item, seen, depth + 1)
      ])
  )
}

export const developmentConsole = (): boolean =>
  process.env.NODE_ENV === undefined || process.env.NODE_ENV === 'development'

export const formatConsole = (record: Record<string, unknown>): string => {
  const {
    timestamp,
    level,
    message,
    code,
    reason,
    hint,
    issues,
    stack,
    component,
    ...context
  } = record
  if (level === 'info' && !code && !reason) {
    return `${String(timestamp)} INFO${component ? ` [${String(component)}]` : ''} ${String(message)}${Object.keys(context).length ? ` ${JSON.stringify(context)}` : ''}`
  }
  const lines = [
    `${String(timestamp)} ${String(level).toUpperCase()}${component ? ` [${String(component)}]` : ''}${code ? ` [${String(code)}]` : ''} ${String(message)}`
  ]
  if (reason) lines.push(`  ${String(reason)}`)
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined)
      lines.push(
        `  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
      )
  }
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (
        issue &&
        typeof issue === 'object' &&
        'field' in issue &&
        'reason' in issue
      )
        lines.push(`  ${String(issue.field)}: ${String(issue.reason)}`)
    }
  }
  if (hint) lines.push(`  Action: ${String(hint)}`)
  if (Array.isArray(stack))
    lines.push(...stack.map(frame => `  ${String(frame)}`))
  return lines.join('\n')
}
