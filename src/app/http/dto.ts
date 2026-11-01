import type { Request, Response } from 'express'
import type { z } from 'zod'
import type { AuthContextDto } from '../../domains/auth/dto.ts'
import type {
  messageKeySchema,
  messageParamsSchema,
  responseMetadataSchema,
  validationIssueSchema,
  errorResponseSchema,
  livenessResponseSchema,
  readinessResponseSchema
} from './schemas.ts'

export type MessageKeyDto = z.infer<typeof messageKeySchema>
export type MessageParamsDto = z.infer<typeof messageParamsSchema>
export type ValidationIssueDto = z.infer<typeof validationIssueSchema>
export type ErrorResponseDto = z.infer<typeof errorResponseSchema>
export type LivenessResponseDto = z.infer<typeof livenessResponseSchema>
export type ReadinessResponseDto = z.infer<typeof readinessResponseSchema>
export type ApiResponseDto<Data = unknown> = z.infer<
  typeof responseMetadataSchema
> & {
  data?: Data
}

export type ApiRequest<
  Body = unknown,
  Params extends Record<string, string> = Record<string, string>
> = Request<Params, unknown, Body>

export type ApiResponse<Data = unknown> = Response<
  ApiResponseDto<Data> | ErrorResponseDto,
  { auth?: AuthContextDto; requestId: string }
>
