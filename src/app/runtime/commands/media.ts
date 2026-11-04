import { parseArgs } from 'node:util'
import { bootstrap } from '../bootstrap.ts'
import { loadProcessConfiguration } from '../../config/process.ts'

await bootstrap('media:cleanup', async () => {
  const { values } = parseArgs({
    options: {
      limit: { type: 'string', default: '100' },
      help: { type: 'boolean', short: 'h' }
    }
  })
  if (values.help) {
    process.stdout.write(
      'Remove expired unused uploads and retry failed file deletions. --limit <1-1000> (default 100)\n'
    )
    return
  }
  await loadProcessConfiguration('media:cleanup')
  const { database } = await import('../../database/mongodb.ts')
  const { cleanupUnusedMedia } =
    await import('../../../domains/media/cleanup.ts')
  try {
    await database.connect({ autoIndex: false })
    const result = await cleanupUnusedMedia(Number(values.limit))
    process.stdout.write(JSON.stringify(result) + '\n')
    if (result.failed) process.exitCode = 1
  } finally {
    await database.disconnect()
  }
})
