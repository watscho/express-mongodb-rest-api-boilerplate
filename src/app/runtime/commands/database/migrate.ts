import { bootstrap } from '../../bootstrap.ts'
import { errorDiagnostic } from '../../diagnostics/diagnostic.ts'
import { reportFailure } from '../../diagnostics/report.ts'
import { createHash } from 'node:crypto'

await bootstrap('db:migrate:legacy', async () => {
  const [
    { database },
    { User },
    { Media },
    { ResetPassword },
    { Verification },
    { logger }
  ] = await Promise.all([
    import('../../../database/mongodb.ts'),
    import('../../../../domains/users/model.ts'),
    import('../../../../domains/media/model.ts'),
    import('../../../../domains/auth/model.ts'),
    import('../../../../domains/auth/verification/model.ts'),
    import('../../logger.ts')
  ])
  let stage = 'mongodb'
  // Run with the API stopped, after backing up the database. This script is rerunnable.
  try {
    await database.connect({ autoIndex: false })
    stage = 'account_versions'
    await User.collection.updateMany(
      { authVersion: { $exists: false } },
      { $set: { authVersion: 0 } }
    )
    await User.collection.updateMany(
      { mutationVersion: { $exists: false } },
      { $set: { mutationVersion: 0 } }
    )

    stage = 'token_hashes'
    for (const model of [ResetPassword, Verification]) {
      const collection = databaseCollection(model.collection.name)
      for await (const document of collection.find({
        accessToken: { $type: 'string' }
      })) {
        if (typeof document.accessToken !== 'string') continue
        await collection.updateOne(
          { _id: document._id },
          {
            $set: {
              tokenHash: createHash('sha256')
                .update(document.accessToken)
                .digest('hex')
            },
            $unset: { accessToken: '' }
          }
        )
      }
    }

    stage = 'media_ownership'
    // Only attached legacy media has provable ownership. Other files remain quarantined.
    await Media.collection.updateMany(
      {
        owner: { $exists: false },
        refType: 'User',
        refId: { $type: 'objectId' }
      },
      [{ $set: { owner: '$refId' } }]
    )
    const unknownOwnership = await Media.collection.countDocuments({
      owner: { $exists: false }
    })
    logger.info('Legacy migration completed', {
      quarantinedMedia: unknownOwnership
    })
  } catch (error) {
    logger.error(
      'Legacy migration failed; keep the API stopped and review migration requirements',
      {
        component: 'db:migrate:legacy',
        stage,
        ...errorDiagnostic(error, { component: 'db:migrate:legacy', stage })
      }
    )
    process.exitCode = 1
  } finally {
    try {
      await database.disconnect()
    } catch (error) {
      reportFailure(error, {
        component: 'db:migrate:legacy',
        stage: 'shutdown'
      })
      process.exitCode = 1
    }
  }

  function databaseCollection(name: string) {
    const connection = User.db.db
    if (!connection) throw new Error('Database is not connected')
    return connection.collection(name)
  }
})
