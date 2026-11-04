import { ConfigurationError } from './errors.ts'

const loaders = {
  runtime: () => import('./runtime.ts'),
  database: () => import('./database.ts'),
  api: () => import('./api.ts'),
  notifications: () => import('./notifications.ts'),
  queue: () => import('./queue.ts'),
  delivery: () => import('./delivery.ts'),
  mail: () => import('./mail.ts'),
  media: () => import('./media.ts')
}
const profiles = {
  api: [
    'runtime',
    'database',
    'api',
    'notifications',
    'queue',
    'delivery',
    'media'
  ],
  'mail-worker': [
    'runtime',
    'database',
    'notifications',
    'queue',
    'delivery',
    'mail'
  ],
  database: ['runtime', 'database'],
  'media:cleanup': ['runtime', 'database', 'media'],
  'mail:queue': ['database', 'delivery']
} as const

// Import all required configuration before importing clients. ESM caches each parsed profile.
export const loadProcessConfiguration = async (
  role: keyof typeof profiles
): Promise<void> => {
  const results = await Promise.allSettled(
    profiles[role].map(profile => loaders[profile]())
  )
  const failures = results.flatMap(result =>
    result.status === 'rejected' ? [result.reason as unknown] : []
  )
  const unexpected = failures.findIndex(
    error => !(error instanceof ConfigurationError)
  )
  if (unexpected >= 0) throw failures[unexpected]
  const issues = failures.flatMap(error => (error as ConfigurationError).issues)
  if (issues.length) throw new ConfigurationError(issues)
}
