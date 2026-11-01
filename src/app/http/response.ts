import type { Response } from 'express'
import type {
  ApiResponseDto,
  ErrorResponseDto,
  MessageKeyDto,
  ValidationIssueDto
} from './dto.ts'

export const getHttpMessageKey = (status: number): MessageKeyDto =>
  `http.status.${status}`

export const respond = <Data = undefined>(
  res: Response,
  messageKey: MessageKeyDto,
  data?: Data,
  status = 200
) => {
  const payload: ApiResponseDto<Data> = {
    ...(data === undefined ? {} : { data }),
    messageKey,
    status
  }
  return res.status(status).json(payload)
}

export const createErrorResponse = (
  status: number,
  messageKey = getHttpMessageKey(status),
  details?: ValidationIssueDto[]
): ErrorResponseDto => ({
  messageKey,
  status,
  ...(details ? { details } : {})
})
