import { errorDiagnostic } from './diagnostic.ts'
import {
  developmentConsole,
  formatConsole,
  sanitizeLogValue
} from './format.ts'
import type { DiagnosticContextDto } from './dto.ts'

// Independent of Winston and validated configuration: import-time failures must be reportable too.
export const reportFailure = (
  error: unknown,
  context: DiagnosticContextDto
): void => {
  const record = sanitizeLogValue({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'Process operation failed',
    ...context,
    ...errorDiagnostic(error, context)
  }) as Record<string, unknown>
  process.stderr.write(
    (developmentConsole() ? formatConsole(record) : JSON.stringify(record)) +
      '\n'
  )
}
