import { isAbsolute, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConfigurationError } from '../../config/errors.ts'
import { projectRoot } from '../paths.ts'
import { DiagnosticError } from './errors.ts'
import { developmentConsole } from './format.ts'
import type { DiagnosticContextDto, DiagnosticDto } from './dto.ts'

const errorTypes = new Set([
  'Error',
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
  'URIError',
  'EvalError',
  'AggregateError',
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoServerError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoParseError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
  'ClientClosedError',
  'ClientOfflineError',
  'SocketClosedUnexpectedlyError',
  'ConfigurationError',
  'DiagnosticError'
])

const applicationFailures: Readonly<
  Record<string, Pick<DiagnosticDto, 'code' | 'reason' | 'hint'>>
> = {
  'notifications.invalid_template_path': {
    code: 'EMAIL_TEMPLATE_INVALID',
    reason:
      'A configured email template file or path is unavailable or invalid.',
    hint: 'Check MAIL_TPL_PATH, the registered template files/includes, process permissions, and the built template assets.'
  },
  'notifications.translation_not_found': {
    code: 'EMAIL_TRANSLATION_MISSING',
    reason: 'A required email translation key is missing.',
    hint: 'Check the registered dictionaries, template translation keys, and default language.'
  },
  'notifications.invalid_rendered_content': {
    code: 'EMAIL_RENDER_INVALID',
    reason: 'Rendered email content failed the output constraints.',
    hint: 'Check nonempty subject/text/HTML, subject line breaks, template variables, and content size limits.'
  },
  'notifications.invalid_cursor': {
    code: 'CLI_ARGUMENTS_INVALID',
    reason: 'The queue cursor is invalid.',
    hint: 'Copy the returned nextCursor without changing it and keep the same status filter.'
  },
  'notifications.invalid_list_options': {
    code: 'CLI_ARGUMENTS_INVALID',
    reason: 'Queue list options are invalid.',
    hint: 'Use the documented status, limit (1–100), and nextCursor formats.'
  }
}

const errorNodes = (error: unknown): Record<string, unknown>[] => {
  const pending: unknown[] = [error]
  const seen = new Set<object>()
  const nodes: Record<string, unknown>[] = []
  while (pending.length && nodes.length < 32) {
    const value = pending.shift()
    if (!value || typeof value !== 'object' || seen.has(value)) continue
    seen.add(value)
    const node = value as Record<string, unknown>
    nodes.push(node)
    pending.push(
      node.cause,
      node.reason,
      node.error,
      node.originalError,
      node.socketError
    )
    if (Array.isArray(node.errors)) pending.push(...node.errors.slice(0, 32))
    if (node.servers instanceof Map)
      pending.push(...Array.from(node.servers.values()).slice(0, 32))
  }
  return nodes
}

const sourceFrames = (error: unknown): string[] => {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return []
  const frames: string[] = []
  for (const line of error.stack.split('\n', 100)) {
    // Keep source locations only: raw error headers, template excerpts, and function arguments may contain secrets.
    if (!/^\s*at\s/.test(line)) continue
    const match = line.match(
      /(?:\(|\s)((?:file:\/\/\/|\/|[A-Za-z]:[\\/])[^()\r\n]+?):(\d+)(?::(\d+))?\)?$/
    )
    if (!match?.[1]) continue
    let path = match[1]
    try {
      if (path.startsWith('file:')) path = fileURLToPath(path)
    } catch {
      continue
    }
    const local = relative(projectRoot, path)
    if (
      !local ||
      local === '..' ||
      local.startsWith(`..${sep}`) ||
      isAbsolute(local)
    )
      continue
    if (!/^[\w./\\ @%+~-]+$/.test(local)) continue
    frames.push(`at ${local}:${match[2]}${match[3] ? `:${match[3]}` : ''}`)
    if (frames.length === 40) break
  }
  return [
    ...frames.filter(frame => !frame.includes('node_modules')),
    ...frames.filter(frame => frame.includes('node_modules'))
  ].slice(0, 12)
}

export const errorDiagnostic = (
  error: unknown,
  context: DiagnosticContextDto
): DiagnosticDto => {
  if (error instanceof ConfigurationError)
    return {
      code: 'CONFIG_INVALID',
      reason: error.message,
      hint: 'Fix all listed settings in the process environment or .env, then restart this process.',
      issues: error.issues
    }
  if (error instanceof DiagnosticError) return error.diagnostic
  if (
    error instanceof Error &&
    error.name === 'AppError' &&
    applicationFailures[error.message]
  )
    return applicationFailures[error.message]!
  const nodes = errorNodes(error)
  for (const node of nodes)
    if (node instanceof DiagnosticError) return node.diagnostic
  const name =
    error instanceof Error && errorTypes.has(error.name) ? error.name : 'Error'
  const codes = nodes.map(node => node.code)
  const mongo =
    context.stage?.startsWith('mongodb') ||
    nodes.some(
      node =>
        typeof node.name === 'string' && /^(?:Mongo|Mongoose)/.test(node.name)
    )
  const resource = mongo
    ? 'MongoDB'
    : context.stage === 'redis'
      ? 'Redis'
      : context.stage === 'smtp'
        ? 'SMTP'
        : 'Dependency'
  const prefix = mongo
    ? 'MONGODB'
    : context.stage === 'redis'
      ? 'REDIS'
      : context.stage === 'smtp'
        ? 'SMTP'
        : 'DEPENDENCY'
  const known = (
    code: string,
    reason: string,
    hint: string,
    sourceCode?: string
  ): DiagnosticDto => ({
    code,
    reason,
    hint,
    errorType: name,
    ...(sourceCode ? { sourceCode } : {})
  })
  if (mongo && codes.includes(13))
    return known(
      'MONGODB_PERMISSION_DENIED',
      'MongoDB did not permit the requested operation.',
      'Check the database user roles and authentication database for the selected process; maintenance requires separate privileges.'
    )
  if (codes.includes('EADDRINUSE'))
    return known(
      'HTTP_PORT_IN_USE',
      'The HTTP listen address is already in use.',
      'Stop the other listener or change APP_HOST/APP_PORT.',
      'EADDRINUSE'
    )
  if (codes.includes('EACCES') || codes.includes('EPERM'))
    return known(
      'PERMISSION_DENIED',
      'The process lacks permission for this operation.',
      'Check the service user, file/directory permissions, and listen-port permissions.'
    )
  if (
    codes.includes(18) ||
    nodes.some(
      node =>
        typeof node.message === 'string' &&
        /^(?:WRONGPASS|NOAUTH)\b/.test(node.message)
    )
  )
    return known(
      `${prefix}_AUTH_FAILED`,
      `${resource} rejected authentication.`,
      mongo
        ? 'Check the database credentials, authSource, user permissions, and URL-encoding of credentials.'
        : 'Check the service username/password or ACL credentials and URL-encoding of credentials.'
    )
  if (codes.includes('ECONNREFUSED'))
    return known(
      `${prefix}_CONNECTION_REFUSED`,
      `${resource} refused the connection.`,
      'Check that the service is running and reachable at the configured host/port; inspect container networking and firewall rules.',
      'ECONNREFUSED'
    )
  if (
    codes.includes('ENOTFOUND') ||
    codes.includes('EAI_AGAIN') ||
    codes.includes('ENODATA') ||
    codes.includes('ESERVFAIL')
  )
    return known(
      `${prefix}_DNS_FAILED`,
      `${resource} hostname or DNS records could not be resolved.`,
      'Check the configured hostname, DNS/SRV records, and network resolver.'
    )
  if (
    codes.some(
      code =>
        typeof code === 'string' &&
        /^(?:ERR_TLS_|ERR_SSL_|CERT_|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_VERIFY_LEAF_SIGNATURE)/.test(
          code
        )
    )
  )
    return known(
      `${prefix}_TLS_FAILED`,
      `${resource} TLS validation or negotiation failed.`,
      'Check the certificate chain, hostname, trusted CA, system clock, and required TLS mode; keep verification enabled.'
    )
  if (
    codes.includes('ETIMEDOUT') ||
    codes.includes('ESOCKETTIMEDOUT') ||
    name === 'MongoNetworkTimeoutError'
  )
    return known(
      `${prefix}_TIMEOUT`,
      `${resource} did not respond before the configured deadline.`,
      'Check reachability and service load before adjusting connection timeouts.'
    )
  if (
    codes.includes('ECONNRESET') ||
    codes.includes('EPIPE') ||
    name === 'SocketClosedUnexpectedlyError'
  )
    return known(
      `${prefix}_CONNECTION_LOST`,
      `${resource} closed the connection unexpectedly.`,
      'Check service restarts, network interruptions, and server connection limits.'
    )
  if (codes.includes(11000))
    return known(
      'MONGODB_UNIQUE_CONFLICT',
      'A MongoDB unique constraint rejected the write.',
      'Reconcile duplicate records or the conflicting operation; inspect the migration/index guide without logging document values.'
    )
  if (
    nodes.some(
      node =>
        typeof node.message === 'string' &&
        node.message.includes(
          'Transaction numbers are only allowed on a replica set'
        )
    )
  )
    return known(
      'MONGODB_TRANSACTIONS_UNAVAILABLE',
      'This MongoDB deployment does not support the required transactions.',
      'Use a replica set or Atlas and configure the replica-set connection correctly.'
    )
  if (name === 'MongoParseError' || codes.includes('ERR_INVALID_URL'))
    return known(
      'CONNECTION_CONFIG_INVALID',
      'A configured connection URL could not be parsed.',
      'Check the documented URI format, escaped credentials, query options, and host syntax.'
    )
  if (
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError'
  )
    return known(
      'MONGODB_UNAVAILABLE',
      'No suitable MongoDB server was selected before the deadline.',
      'Check replica-set membership/primary readiness, DNS, network access, TLS, and connection settings.'
    )
  if (
    [
      'MongoNotConnectedError',
      'MongoTopologyClosedError',
      'ClientClosedError',
      'ClientOfflineError'
    ].includes(name)
  )
    return known(
      `${prefix}_NOT_CONNECTED`,
      `${resource} is not connected.`,
      'Check dependency readiness and connection lifecycle; restart only after correcting the underlying failure.'
    )
  if (codes.includes('ENOENT'))
    return known(
      'FILE_NOT_FOUND',
      'A required file or directory is missing.',
      'Check configured storage/template/output directories and deployment mounts; do not expose secret-file paths.',
      'ENOENT'
    )
  if (codes.includes('EEXIST'))
    return known(
      'OUTPUT_ALREADY_EXISTS',
      'The output file already exists.',
      'Choose a new output path; existing files are deliberately not overwritten.',
      'EEXIST'
    )
  if (
    codes.some(
      code => typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_')
    )
  )
    return known(
      'CLI_ARGUMENTS_INVALID',
      'Command-line arguments are invalid.',
      'Use the command help and documented options; do not pass secrets as CLI arguments.'
    )
  if (
    codes.includes('ERR_MODULE_NOT_FOUND') ||
    codes.includes('MODULE_NOT_FOUND')
  )
    return known(
      'MODULE_NOT_FOUND',
      'A required application module or dependency is missing.',
      'Install the locked dependencies and rebuild the application before starting it.'
    )
  let reason = `${name}: an unexpected application error occurred.`
  if (error instanceof TypeError) {
    const missing = error.message.match(
      /^Cannot (read|set) properties of (undefined|null)\b/
    )
    if (missing)
      reason = `TypeError: cannot ${missing[1]} properties of ${missing[2]}.`
    else if (/is not a function$/.test(error.message))
      reason = 'TypeError: a non-function value was called.'
  } else if (error instanceof ReferenceError)
    reason =
      'ReferenceError: an undefined or uninitialized variable was referenced.'
  else if (error instanceof SyntaxError)
    reason = 'SyntaxError: application code or parsed data has invalid syntax.'
  return {
    code: 'UNEXPECTED_ERROR',
    errorType: name,
    reason,
    hint: 'Inspect the source locations and request/job context. Raw exception messages are intentionally omitted.',
    ...(developmentConsole() ? { stack: sourceFrames(error) } : {})
  }
}
