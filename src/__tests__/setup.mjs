import { readFileSync } from 'node:fs'

// Ignore shell overrides and the developer's .env; tests supply their own settings.
for (const line of readFileSync(
  new URL('../../.env.example', import.meta.url),
  'utf8'
).split('\n')) {
  const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]
  if (key) {
    delete process.env[key]
    delete process.env[key + '_FILE']
  }
}
process.env.DOTENV_CONFIG_PATH = '/dev/null'

// Unit tests must never use local credentials or contact real services.
Object.assign(process.env, {
  NODE_ENV: 'development',
  JWT_SECRET: 'unit-test-secret-'.repeat(4),
  MAIL_QUEUE_ENCRYPTION_KEY: 'ab'.repeat(32),
  MONGODB_URI: 'mongodb://127.0.0.1:1/unit_tests',
  REDIS_URI: 'redis://127.0.0.1:1',
  BCRYPT_ROUNDS: '10',
  APP_URL: 'http://localhost:8000',
  CLIENT_URL: 'http://localhost:3000',
  MAIL_HOST: '127.0.0.1',
  MAIL_PORT: '1',
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  MAIL_FROM: 'Unit <unit@example.test>',
  LOG_LEVEL: 'error',
  MAIL_DEFAULT_LANGUAGE: 'en',
  DOCS_ENABLED: 'false'
})
for (const key of Object.keys(process.env)) {
  if (key.endsWith('_FILE')) delete process.env[key]
}
