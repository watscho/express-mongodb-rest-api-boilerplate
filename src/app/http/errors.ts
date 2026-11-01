import { getHttpMessageKey } from './response.ts'
import type { MessageKeyDto, ValidationIssueDto } from './dto.ts'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly messageKey: MessageKeyDto = getHttpMessageKey(status),
    public readonly details?: ValidationIssueDto[]
  ) {
    super(messageKey)
    this.name = 'AppError'
  }
}
