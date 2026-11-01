import { parseArgs } from 'node:util'
import type { database as databaseClient } from '../../database/mongodb.ts'

const help = `Email queue administration (JSON output; no recipients or decrypted content)
  stats                            Queue counts, backlog age, active workers
  list [--status failed] [--limit 25] [--cursor <opaque-cursor>]
  show --id <delivery-id>           Safe metadata for one job
  retry --id <delivery-id>          Requeue one unexpired failed job
  workers                          Worker heartbeats and stale status
  health                           Exit 0 for a fresh running worker; 2 if unavailable
Use --help without database credentials. Retry is an explicit database mutation;
an already-running worker may subsequently send the selected email.
`

import { bootstrap } from '../bootstrap.ts'
import { loadProcessConfiguration } from '../../config/process.ts'
import { DiagnosticError } from '../diagnostics/errors.ts'
import { reportFailure } from '../diagnostics/report.ts'

await bootstrap('mail:queue', async () => {
  const args = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      id: { type: 'string' },
      status: { type: 'string' },
      limit: { type: 'string' },
      cursor: { type: 'string' }
    }
  })
  if (args.values.help || args.positionals.length === 0)
    process.stdout.write(help)
  else {
    const { queueCommandSchema } =
      await import('../../../domains/notifications/delivery/schemas.ts')
    const input = queueCommandSchema.safeParse({
      command: args.positionals.length === 1 ? args.positionals[0] : undefined,
      ...args.values
    })
    if (!input.success) {
      throw new DiagnosticError({
        code: 'CLI_ARGUMENTS_INVALID',
        reason: 'Invalid queue command or options.',
        hint: 'Use mail:queue --help and the documented status, ID, limit, and cursor formats.'
      })
    } else {
      // Diagnostic commands need MongoDB only, never JWT/Redis/SMTP or payload decryption keys.
      let database: typeof databaseClient | undefined
      let stage = 'configuration'
      try {
        await loadProcessConfiguration('mail:queue')
        ;({ database } = await import('../../database/mongodb.ts'))
        const { deliveryOperations } =
          await import('../../../domains/notifications/delivery/operations.ts')
        stage = 'mongodb'
        await database.connect({ autoIndex: false })
        stage = 'queue_command'
        const command = input.data
        let result: unknown
        switch (command.command) {
          case 'stats':
            result = await deliveryOperations.stats()
            break
          case 'list':
            result = await deliveryOperations.list(command)
            break
          case 'show':
            result = await deliveryOperations.show(command.id)
            if (!result) process.exitCode = 2
            break
          case 'retry':
            result = await deliveryOperations.retry(command.id)
            if (!result) process.exitCode = 2
            break
          case 'workers':
            result = await deliveryOperations.workers()
            break
          case 'health': {
            const ready = await deliveryOperations.healthy()
            result = { status: ready ? 'ready' : 'unavailable' }
            if (!ready) process.exitCode = 2
            break
          }
        }
        process.stdout.write(JSON.stringify(result, null, 2) + '\n')
      } catch (error) {
        reportFailure(error, { component: 'mail:queue', stage })
        process.exitCode = 1
      } finally {
        try {
          await database?.disconnect()
        } catch (error) {
          reportFailure(error, { component: 'mail:queue', stage: 'shutdown' })
          process.exitCode = 1
        }
      }
    }
  }
})
