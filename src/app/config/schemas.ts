import { z } from 'zod'

export const configurationIssueSchema = z.object({
  field: z.string(),
  code: z.string(),
  reason: z.string()
})

const port = z.coerce.number().int().min(1).max(65535)
const positiveInteger = z.coerce.number().int().positive()
const booleanSetting = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true')
const httpUrl = z.url({ protocol: /^https?$/ }).superRefine((value, ctx) => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return // The URL schema already reports malformed URLs.
  }
  if (url.username || url.password || url.search || url.hash) {
    ctx.addIssue({
      code: 'custom',
      message:
        'Application URLs must not contain credentials, query parameters, or fragments'
    })
  }
})

const secondsPerUnit: Record<string, number> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31557600
}
const tokenLifetime = z
  .string()
  .regex(/^[1-9]\d*(?:ms|s|m|h|d|w|y)$/)
  .default('24h')
  .transform(value =>
    Math.floor(
      Number.parseInt(value, 10) * secondsPerUnit[value.replace(/^\d+/, '')]!
    )
  )
  .pipe(z.number().int().positive())

const settingsSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  APP_PORT: port.default(8000),
  APP_HOST: z.string().min(1).default('0.0.0.0'),
  APP_URL: httpUrl.default('http://localhost:8000'),
  CLIENT_URL: httpUrl.default('http://localhost:3000'),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  MONGODB_MAX_POOL_SIZE: positiveInteger.max(500).default(20),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(500).default(0),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInteger
    .max(120000)
    .default(10000),
  MONGODB_CONNECT_TIMEOUT_MS: positiveInteger.max(120000).default(10000),
  MONGODB_WAIT_QUEUE_TIMEOUT_MS: positiveInteger.max(120000).default(10000),
  MONGODB_MAX_IDLE_TIME_MS: positiveInteger.max(3600000).default(60000),
  MONGODB_AUTO_INDEX: booleanSetting,
  REDIS_URI: z.url({ protocol: /^rediss?$/ }),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRATION: tokenLifetime,
  JWT_ISSUER: z.string().min(1).default('express-mongodb-api'),
  JWT_AUDIENCE: z.string().min(1).default('express-mongodb-client'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),
  MAIL_HOST: z.string().min(1).default('127.0.0.1'),
  MAIL_PORT: port.default(1025),
  MAIL_SECURE: booleanSetting,
  MAIL_REQUIRE_TLS: booleanSetting,
  MAIL_USER: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().min(1).default('API <no-reply@example.com>'),
  MAIL_TPL_PATH: z.string().min(1).optional(),
  MAIL_DEFAULT_LANGUAGE: z.string().min(2).max(64).default('en'),
  MAIL_QUEUE_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  MAIL_MESSAGE_ID_DOMAIN: z.hostname().default('notifications.local'),
  MAIL_QUEUE_MAX_ATTEMPTS: positiveInteger.max(100).default(8),
  MAIL_QUEUE_MAX_AGE_MS: positiveInteger.max(7 * 86400000).default(86400000),
  MAIL_QUEUE_RETENTION_MS: positiveInteger
    .max(90 * 86400000)
    .default(7 * 86400000),
  MAIL_WORKER_HEARTBEAT_MS: positiveInteger.min(1000).max(60000).default(10000),
  MAIL_WORKER_STALE_MS: positiveInteger.min(5000).max(600000).default(45000),
  MAIL_WORKER_CONCURRENCY: positiveInteger.max(20).default(2),
  MAIL_WORKER_POLL_MS: positiveInteger.min(100).max(60000).default(1000),
  MAIL_WORKER_LEASE_MS: positiveInteger.min(30000).max(600000).default(60000),
  MAIL_WORKER_SHUTDOWN_TIMEOUT_MS: positiveInteger.max(600000).default(60000),
  MAIL_RETRY_BASE_DELAY_MS: positiveInteger.max(3600000).default(30000),
  MAIL_RETRY_MAX_DELAY_MS: positiveInteger.max(86400000).default(3600000),
  DOCS_ENABLED: booleanSetting,
  DOCS_TRY_IT_OUT_ENABLED: booleanSetting,
  DOCS_USERNAME: z.preprocess(
    value => (value === '' ? undefined : value),
    z
      .string()
      .min(1)
      .max(128)
      .regex(/^[^:\r\n]+$/)
      .optional()
  ),
  DOCS_PASSWORD: z.preprocess(
    value => (value === '' ? undefined : value),
    z.string().min(32).max(1024).optional()
  ),
  STORAGE_PATH: z.string().min(1).default('storage/public'),
  STORAGE_URL: z
    .string()
    .regex(/^\/[a-zA-Z0-9/_-]*$/)
    .default('/storage/public'),
  MAX_UPLOAD_BYTES: positiveInteger.default(10 * 1024 * 1024),
  RATE_LIMIT_WINDOW_MS: positiveInteger.default(15 * 60 * 1000),
  RATE_LIMIT_MAX: positiveInteger.default(100),
  AUTH_RATE_LIMIT_MAX: positiveInteger.default(10),
  TRUST_PROXY: z.string().default(''),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  API_LOG_FILENAME: z.string().min(1).optional(),
  SHUTDOWN_TIMEOUT_MS: positiveInteger.default(10000)
})

export const runtimeEnvironmentSchema = settingsSchema.pick({
  NODE_ENV: true,
  LOG_LEVEL: true,
  API_LOG_FILENAME: true
})
export const databaseEnvironmentSchema = settingsSchema
  .pick({
    MONGODB_URI: true,
    MONGODB_AUTO_INDEX: true,
    MONGODB_MAX_POOL_SIZE: true,
    MONGODB_MIN_POOL_SIZE: true,
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: true,
    MONGODB_CONNECT_TIMEOUT_MS: true,
    MONGODB_WAIT_QUEUE_TIMEOUT_MS: true,
    MONGODB_MAX_IDLE_TIME_MS: true
  })
  .superRefine((value, ctx) => {
    if (value.MONGODB_MIN_POOL_SIZE > value.MONGODB_MAX_POOL_SIZE) {
      ctx.addIssue({
        code: 'custom',
        path: ['MONGODB_MIN_POOL_SIZE'],
        message: 'Minimum pool size exceeds maximum'
      })
    }
  })
export const apiEnvironmentSchema = settingsSchema
  .pick({
    NODE_ENV: true,
    APP_PORT: true,
    APP_HOST: true,
    APP_URL: true,
    CLIENT_URL: true,
    REDIS_URI: true,
    JWT_SECRET: true,
    JWT_EXPIRATION: true,
    JWT_ISSUER: true,
    JWT_AUDIENCE: true,
    BCRYPT_ROUNDS: true,
    STORAGE_PATH: true,
    STORAGE_URL: true,
    MAX_UPLOAD_BYTES: true,
    RATE_LIMIT_WINDOW_MS: true,
    RATE_LIMIT_MAX: true,
    AUTH_RATE_LIMIT_MAX: true,
    TRUST_PROXY: true,
    SHUTDOWN_TIMEOUT_MS: true,
    DOCS_ENABLED: true,
    DOCS_TRY_IT_OUT_ENABLED: true,
    DOCS_USERNAME: true,
    DOCS_PASSWORD: true
  })
  .superRefine((value, ctx) => {
    if (
      Boolean(value.DOCS_USERNAME) !== Boolean(value.DOCS_PASSWORD) ||
      (value.NODE_ENV === 'production' &&
        value.DOCS_ENABLED &&
        !value.DOCS_PASSWORD)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DOCS_PASSWORD'],
        message:
          'Enabled production documentation requires dedicated username and password'
      })
    }
  })
export const notificationEnvironmentSchema = settingsSchema.pick({
  NODE_ENV: true,
  CLIENT_URL: true,
  MAIL_TPL_PATH: true,
  MAIL_DEFAULT_LANGUAGE: true
})
export const queueEnvironmentSchema = settingsSchema.pick({
  MAIL_QUEUE_ENCRYPTION_KEY: true
})
export const deliveryEnvironmentSchema = settingsSchema
  .pick({
    MAIL_QUEUE_MAX_ATTEMPTS: true,
    MAIL_QUEUE_MAX_AGE_MS: true,
    MAIL_QUEUE_RETENTION_MS: true,
    MAIL_WORKER_CONCURRENCY: true,
    MAIL_WORKER_POLL_MS: true,
    MAIL_WORKER_LEASE_MS: true,
    MAIL_WORKER_SHUTDOWN_TIMEOUT_MS: true,
    MAIL_RETRY_BASE_DELAY_MS: true,
    MAIL_RETRY_MAX_DELAY_MS: true,
    MAIL_WORKER_HEARTBEAT_MS: true,
    MAIL_WORKER_STALE_MS: true
  })
  .superRefine((value, ctx) => {
    if (value.MAIL_RETRY_BASE_DELAY_MS > value.MAIL_RETRY_MAX_DELAY_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_RETRY_MAX_DELAY_MS'],
        message: 'Mail retry maximum must be at least the base delay'
      })
    }
    if (value.MAIL_WORKER_STALE_MS < value.MAIL_WORKER_HEARTBEAT_MS * 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_WORKER_STALE_MS'],
        message: 'Worker stale threshold must cover at least three heartbeats'
      })
    }
  })
export const mailEnvironmentSchema = settingsSchema
  .pick({
    MAIL_HOST: true,
    MAIL_PORT: true,
    MAIL_SECURE: true,
    MAIL_REQUIRE_TLS: true,
    MAIL_USER: true,
    MAIL_PASSWORD: true,
    MAIL_FROM: true,
    MAIL_MESSAGE_ID_DOMAIN: true,
    MAIL_WORKER_CONCURRENCY: true
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.MAIL_USER) !== Boolean(value.MAIL_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_USER'],
        message: 'SMTP username and password must be supplied together'
      })
    }
  })
