import { bootstrap } from '../../bootstrap.ts'
import { errorDiagnostic } from '../../diagnostics/diagnostic.ts'
import { reportFailure } from '../../diagnostics/report.ts'
import { DiagnosticError } from '../../diagnostics/errors.ts'

await bootstrap('db:indexes', async () => {
  const [
    { database },
    { User },
    { Media },
    { ResetPassword },
    { Verification },
    { EmailOutbox, EmailWorker },
    { EmailBudget },
    { logger }
  ] = await Promise.all([
    import('../../../database/mongodb.ts'),
    import('../../../../domains/users/model.ts'),
    import('../../../../domains/media/model.ts'),
    import('../../../../domains/auth/model.ts'),
    import('../../../../domains/auth/verification/model.ts'),
    import('../../../../domains/notifications/delivery/model.ts'),
    import('../../../../domains/notifications/delivery/budget-model.ts'),
    import('../../logger.ts')
  ])
  let stage = 'mongodb'
  try {
    await database.connect({ autoIndex: false })
    // Fail before any index DDL if existing data violates new uniqueness rules.
    const constraints = [
      { model: User, field: 'email', match: {} },
      { model: ResetPassword, field: 'user', match: {} },
      { model: ResetPassword, field: 'tokenHash', match: {} },
      { model: Verification, field: 'user', match: {} },
      { model: Verification, field: 'tokenHash', match: {} },
      {
        model: Media,
        field: 'owner',
        match: { refType: 'User', owner: { $type: 'objectId' } }
      }
    ]
    for (const { model, field, match } of constraints) {
      stage = `constraints:${model.modelName}:${field}`
      const conflicts = await model.collection
        .aggregate(
          [
            { $match: match },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $limit: 1 },
            { $project: { _id: 0, count: 1 } }
          ],
          { maxTimeMS: 60000 }
        )
        .toArray()
      if (conflicts.length)
        throw new DiagnosticError({
          code: 'INDEX_CONFLICT',
          reason: 'Duplicate records prevent the requested unique indexes.',
          hint: 'Keep writers stopped, reconcile duplicate groups, and follow docs/migration.md before creating unique indexes.'
        })
    }
    // Create missing indexes without dropping existing operator-managed indexes.
    for (const model of [
      User,
      Media,
      ResetPassword,
      Verification,
      EmailOutbox,
      EmailWorker,
      EmailBudget
    ]) {
      stage = `indexes:${model.modelName}`
      await model.createCollection()
      await model.createIndexes()
      logger.info('Indexes created', { model: model.modelName })
    }
  } catch (error) {
    logger.error(
      'Index creation failed; review duplicates and migration prerequisites',
      {
        component: 'db:indexes',
        stage,
        ...errorDiagnostic(error, { component: 'db:indexes', stage })
      }
    )
    process.exitCode = 1
  } finally {
    try {
      await database.disconnect()
    } catch (error) {
      reportFailure(error, { component: 'db:indexes', stage: 'shutdown' })
      process.exitCode = 1
    }
  }
})
