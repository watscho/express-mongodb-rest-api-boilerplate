import type { OpenAPIV3_1 } from 'openapi-types'
import type { z } from 'zod'
import type { MessageKeyDto } from '../dto.ts'

// openapi-types 12 retains OpenAPI 3.0 operations in PathItemObject and 3.0
// schemas in ParameterObject. Replace those members with their 3.1 counterparts.
export type OpenApiDocumentDto = Omit<OpenAPIV3_1.Document, 'paths'> & {
  paths: OpenApiPathsDto
}
export type OpenApiSchemaDto = OpenAPIV3_1.SchemaObject
type OpenApiParameterDto = Omit<
  OpenAPIV3_1.ParameterObject,
  'schema' | 'content'
> & {
  schema?: OpenApiSchemaDto | OpenAPIV3_1.ReferenceObject
  content?: Record<string, OpenAPIV3_1.MediaTypeObject>
}
type OpenApiPathItemDto = Omit<
  OpenAPIV3_1.PathItemObject,
  OpenAPIV3_1.HttpMethods | 'parameters'
> & {
  [Method in OpenAPIV3_1.HttpMethods]?: OpenApiOperationDto
} & {
  parameters?: (OpenApiParameterDto | OpenAPIV3_1.ReferenceObject)[]
}
export type OpenApiPathsDto = Record<string, OpenApiPathItemDto>
export type OpenApiResponseDto = OpenAPIV3_1.ResponseObject
export type OpenApiOperationDto = Omit<
  OpenAPIV3_1.OperationObject,
  'parameters'
> & {
  parameters?: (OpenApiParameterDto | OpenAPIV3_1.ReferenceObject)[]
}
export type EndpointDocumentationDto = {
  operationId: string
  summary: string
  description: string
  tag: string
  access: 'authenticated' | 'guest' | 'public'
  params?: z.ZodObject
  response?: z.ZodType
  messageKey: MessageKeyDto
  emailLanguage?: boolean
  errors?: number[]
} & (
  | { body?: z.ZodType; requestBody?: never }
  | { body?: never; requestBody: OpenAPIV3_1.RequestBodyObject }
)
