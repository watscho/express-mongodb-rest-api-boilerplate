import { z } from 'zod'
import type { OpenAPIV3_1 } from 'openapi-types'
import { emailSchema } from '../../../domains/users/schemas.ts'
import {
  passwordSchema,
  currentPasswordSchema
} from '../../../domains/auth/schemas.ts'
import { responseMetadataSchema } from '../schemas.ts'
import type {
  EndpointDocumentationDto,
  OpenApiOperationDto,
  OpenApiResponseDto,
  OpenApiSchemaDto
} from './dto.ts'

const errorDescriptions: Partial<Record<number, string>> = {
  400: 'Invalid payload, parameters, or action.',
  401: 'Missing, malformed, expired, revoked, or superseded credentials.',
  403: 'Forbidden operation or invalid/expired single-use token.',
  404: 'Resource not found.',
  409: 'Unique constraint conflict, including duplicate account email.',
  413: 'Upload or request body exceeds the configured limit.',
  415: 'Unsupported request charset or content encoding.',
  429: 'Request rate exceeded; respect Retry-After.',
  500: 'Internal error or required dependency unavailable.'
}

const rateLimitHeaders: NonNullable<OpenApiResponseDto['headers']> = {
  RateLimit: {
    description: 'Applicable request limits and remaining quota.',
    schema: { type: 'string' }
  },
  'RateLimit-Policy': {
    description: 'Applicable rate-limit policies.',
    schema: { type: 'string' }
  }
}

export const jsonSchema = (
  schema: z.ZodType,
  io: 'input' | 'output' = 'input'
): OpenApiSchemaDto => {
  const converted = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io,
    reused: 'inline',
    override: ({ zodSchema, jsonSchema: output }) => {
      if (zodSchema === emailSchema) {
        output.format = 'email'
        output.maxLength = 254
      }
      if (zodSchema === passwordSchema || zodSchema === currentPasswordSchema) {
        output.format = 'password'
        output.writeOnly = true
      }
    }
  })
  // OpenAPI 3.1 uses the same JSON Schema dialect; Standard Schema helpers are not part of the wire document.
  const { $schema: _dialect, '~standard': _standard, ...document } = converted
  return document as OpenApiSchemaDto
}

export const jsonResponse = (
  schema: OpenApiSchemaDto | OpenAPIV3_1.ReferenceObject,
  description: string,
  headers: NonNullable<OpenApiResponseDto['headers']> = {}
): OpenApiResponseDto => ({
  description,
  headers: {
    'X-Request-Id': {
      description: 'Server-generated correlation ID.',
      schema: { type: 'string', format: 'uuid' }
    },
    'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } },
    ...headers
  },
  content: { 'application/json': { schema } }
})

export const operation = (
  definition: EndpointDocumentationDto
): OpenApiOperationDto => {
  const metadata = responseMetadataSchema.extend({
    messageKey: z.literal(definition.messageKey),
    status: z.literal(200)
  })
  const success = definition.response
    ? metadata.extend({ data: definition.response })
    : metadata
  const errors = [
    ...new Set([
      400,
      401,
      413,
      415,
      429,
      500,
      ...(definition.access === 'guest' ? [403] : []),
      ...(definition.errors ?? [])
    ])
  ]
  const bodySchema = definition.body ? jsonSchema(definition.body) : undefined
  return {
    operationId: definition.operationId,
    summary: definition.summary,
    description:
      definition.description +
      (definition.access === 'guest'
        ? ' Requires an anonymous request: omit Authorization; an authenticated account is rejected with 403.'
        : ''),
    tags: [definition.tag],
    security:
      definition.access === 'authenticated'
        ? [{ bearerAuth: [] }]
        : definition.access === 'public'
          ? [{}, { bearerAuth: [] }]
          : [],
    parameters: [
      ...(definition.emailLanguage
        ? [
            {
              in: 'header',
              name: 'Accept-Language',
              required: false,
              description:
                'Language preference for the queued email only. Positive q weights and regional fallback are supported; API message keys are locale-independent.',
              schema: { type: 'string' as const, maxLength: 1024 },
              example: 'ka-GE, ka;q=0.9, en;q=0.7'
            }
          ]
        : []),
      ...Object.entries(definition.params?.shape ?? {}).map(
        ([name, schema]) => ({
          in: 'path' as const,
          name,
          required: true,
          schema: jsonSchema(schema)
        })
      )
    ],
    ...(bodySchema
      ? {
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: bodySchema },
              'application/x-www-form-urlencoded': { schema: bodySchema }
            }
          }
        }
      : definition.requestBody
        ? { requestBody: definition.requestBody }
        : {}),
    responses: {
      '200': jsonResponse(
        jsonSchema(success, 'output'),
        'Operation completed. Translate messageKey on the client.',
        rateLimitHeaders
      ),
      ...Object.fromEntries(
        errors.map(status => [
          String(status),
          jsonResponse(
            { $ref: '#/components/schemas/ErrorResponse' },
            errorDescriptions[status] ?? 'Request failed.',
            {
              ...rateLimitHeaders,
              ...(status === 401
                ? {
                    'WWW-Authenticate': {
                      schema: { type: 'string' },
                      example: 'Bearer'
                    }
                  }
                : {}),
              ...(status === 429
                ? {
                    'Retry-After': { schema: { type: 'string' } }
                  }
                : {})
            }
          )
        ])
      )
    }
  }
}
