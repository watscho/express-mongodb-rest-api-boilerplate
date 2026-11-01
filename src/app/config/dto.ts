import type { ConnectOptions } from 'mongoose'
import type { z } from 'zod'
import type { configurationIssueSchema } from './schemas.ts'

export type DatabaseConnectionOptionsDto = Pick<ConnectOptions, 'autoIndex'>
export type ConfigurationIssueDto = z.infer<typeof configurationIssueSchema>
