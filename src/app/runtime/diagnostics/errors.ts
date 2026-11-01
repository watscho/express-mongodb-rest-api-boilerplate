import type { DiagnosticDto } from './dto.ts'

// Only authored, value-free descriptions belong here; never wrap a raw driver message.
export class DiagnosticError extends Error {
  constructor(
    public readonly diagnostic: Pick<DiagnosticDto, 'code' | 'reason' | 'hint'>
  ) {
    super(diagnostic.reason)
    this.name = 'DiagnosticError'
  }
}
