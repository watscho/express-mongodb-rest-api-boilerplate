import type { ConfigurationIssueDto } from './dto.ts'

export class ConfigurationError extends Error {
  readonly issues: ConfigurationIssueDto[]

  constructor(issues: ConfigurationIssueDto[]) {
    super('Environment configuration is missing or invalid')
    this.name = 'ConfigurationError'
    this.issues = [
      ...new Map(issues.map(issue => [JSON.stringify(issue), issue])).values()
    ]
  }
}
