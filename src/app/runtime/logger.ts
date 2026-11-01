import { createLogger, format, transports } from 'winston'
import { runtimeEnv as env } from '../config/runtime.ts'
import {
  developmentConsole,
  formatConsole,
  sanitizeLogValue
} from './diagnostics/format.ts'
import { reportFailure } from './diagnostics/report.ts'

const sanitize = format(info => {
  const record = sanitizeLogValue(info) as Record<string, unknown>
  return {
    ...record,
    timestamp: record.timestamp ?? new Date().toISOString(),
    level: info.level,
    message: typeof record.message === 'string' ? record.message : 'Log event',
    [Symbol.for('level')]: info[Symbol.for('level')]
  }
})

export const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(format.timestamp(), sanitize()),
  transports: [
    new transports.Console({
      stderrLevels: ['error', 'warn'],
      format: developmentConsole()
        ? format.printf(info => formatConsole(info))
        : format.json()
    }),
    ...(env.API_LOG_FILENAME
      ? [
          new transports.File({
            filename: env.API_LOG_FILENAME,
            format: format.json()
          })
        ]
      : [])
  ]
})

logger.on('error', error =>
  reportFailure(error, { component: 'logger', stage: 'log_output' })
)
