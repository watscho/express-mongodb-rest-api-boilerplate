import mongoose from 'mongoose'
import multer from 'multer'
import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.ts'
import { logger } from '../../runtime/logger.ts'
import { createErrorResponse } from '../response.ts'
import type { MessageKeyDto, ValidationIssueDto } from '../dto.ts'
import { errorDiagnostic } from '../../runtime/diagnostics/diagnostic.ts'

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next
) => {
  if (res.headersSent) {
    logger.error('Request failed after response headers were sent', {
      component: 'api',
      stage: 'http',
      requestId: res.locals.requestId,
      method: req.method,
      route:
        typeof req.route?.path === 'string' ? req.route.path : '[unmatched]',
      status: res.statusCode,
      headersSent: true,
      ...errorDiagnostic(error, { component: 'api', stage: 'http' })
    })
    if (!res.writableEnded) res.destroy()
    return
  }
  let status = 500
  let messageKey: MessageKeyDto | undefined
  let details: ValidationIssueDto[] | undefined
  if (error instanceof AppError) {
    status = error.status
    messageKey = error.messageKey
    details = error.details
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    messageKey =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'media.file_too_large'
        : 'media.invalid_upload'
  } else if (
    error instanceof mongoose.Error.ValidationError ||
    error instanceof mongoose.Error.CastError
  ) {
    status = 400
  } else if (
    error instanceof Error &&
    'code' in error &&
    error.code === 11000
  ) {
    status = 409
  } else if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    [400, 404, 405, 413, 415, 416].includes(error.status)
  ) {
    status = error.status
  }
  if (status >= 500)
    logger.error('Request failed', {
      component: 'api',
      stage: 'http',
      requestId: res.locals.requestId,
      method: req.method,
      route:
        typeof req.route?.path === 'string' ? req.route.path : '[unmatched]',
      status,
      ...errorDiagnostic(error, { component: 'api', stage: 'http' })
    })
  res.setHeader('Cache-Control', 'no-store')
  if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer')
  res.status(status).json(createErrorResponse(status, messageKey, details))
}
