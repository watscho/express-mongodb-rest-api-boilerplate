import { loadProcessConfiguration } from '../config/process.ts'
import { reportFailure } from './diagnostics/report.ts'

export const bootstrap = async (
  component: string,
  start: () => Promise<unknown>
): Promise<void> => {
  let stage = 'configuration'
  try {
    if (component !== 'docs:export') await import('dotenv/config')
    if (component === 'api' || component === 'mail-worker')
      await loadProcessConfiguration(component)
    if (component === 'db:indexes' || component === 'db:migrate:legacy')
      await loadProcessConfiguration('database')
    stage = 'module_loading'
    await start()
  } catch (error) {
    reportFailure(error, { component, stage })
    process.exitCode = 1
  }
}
