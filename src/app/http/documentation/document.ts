import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../../runtime/paths.ts'
import { packageMetadataSchema } from './schemas.ts'
import { jsonResponse, jsonSchema } from './utils.ts'
import {
  errorResponseSchema,
  livenessResponseSchema,
  readinessResponseSchema
} from '../schemas.ts'
import { createAuthDocumentation } from '../../../domains/auth/documentation.ts'
import { createUserDocumentation } from '../../../domains/users/documentation.ts'
import { createMediaDocumentation } from '../../../domains/media/documentation.ts'
import { createNotificationDocumentation } from '../../../domains/notifications/documentation.ts'
import type { OpenApiDocumentDto } from './dto.ts'

export const createOpenApiDocument = (serverUrl = '/'): OpenApiDocumentDto => {
  const metadata = packageMetadataSchema.safeParse(
    JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf8')
    ) as unknown
  )
  if (!metadata.success) throw new Error('Invalid public package metadata')
  const { version, description, homepage, license } = metadata.data
  return {
    openapi: '3.1.2',
    jsonSchemaDialect: 'https://spec.openapis.org/oas/3.1/dialect/base',
    info: {
      title: 'Express MongoDB REST API',
      version,
      description: `${description}\n\nAPI responses expose translation keys, not localized prose. Unknown JSON fields are stripped. All application endpoints reject invalid Authorization headers, even if anonymous access is allowed. Email delivery runs asynchronously after transaction commit; successful API calls do not establish inbox delivery. JWT replacement is required after password/email/verification changes.\n\nSingle-use tokens appear in legacy URL paths: configure reverse-proxy/access-log redaction. Public image conversions are served separately under the configured storage prefix. Health and documentation routes bypass account authentication.`,
      license: { name: license },
      contact: { url: homepage }
    },
    servers: [
      {
        url: serverUrl,
        description: 'API base URL; keep reverse-proxy prefixes when exporting.'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Account creation, access tokens, and revocation.'
      },
      {
        name: 'Password',
        description: 'Password changes and single-use reset links.'
      },
      {
        name: 'Verification',
        description: 'Email ownership verification inside the auth domain.'
      },
      {
        name: 'Account',
        description: 'Authenticated profile and account mutations.'
      },
      { name: 'Media', description: 'Owned images and avatar attachment.' },
      { name: 'Notifications', description: 'Server-owned template catalog.' },
      {
        name: 'Health',
        description:
          'Process/dependency status. No response envelope or authentication.'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Use the accessToken returned by authentication. JWTs expire and can be revoked or invalidated by account changes.'
        }
      },
      schemas: {
        ErrorResponse: jsonSchema(errorResponseSchema, 'output'),
        Liveness: jsonSchema(livenessResponseSchema, 'output')
      }
    },
    paths: {
      ...createAuthDocumentation(),
      ...createUserDocumentation(),
      ...createMediaDocumentation(),
      ...createNotificationDocumentation(),
      '/health/live': {
        get: {
          operationId: 'getLiveness',
          summary: 'Process liveness',
          tags: ['Health'],
          security: [],
          responses: {
            '200': jsonResponse(
              { $ref: '#/components/schemas/Liveness' },
              'HTTP process is running.'
            )
          }
        }
      },
      '/health/ready': {
        get: {
          operationId: 'getReadiness',
          summary: 'API dependency readiness',
          description:
            'Checks MongoDB connection state and Redis readiness. Does not report worker progress or SMTP availability.',
          tags: ['Health'],
          security: [],
          responses: {
            '200': jsonResponse(
              jsonSchema(
                readinessResponseSchema.extend({
                  status: readinessResponseSchema.shape.status.extract([
                    'ready'
                  ])
                }),
                'output'
              ),
              'MongoDB and Redis are ready.'
            ),
            '503': jsonResponse(
              jsonSchema(
                readinessResponseSchema.extend({
                  status: readinessResponseSchema.shape.status.extract([
                    'unavailable'
                  ])
                }),
                'output'
              ),
              'MongoDB or Redis is unavailable.'
            )
          }
        }
      }
    }
  }
}
