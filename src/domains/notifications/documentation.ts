import { operation } from '../../app/http/documentation/utils.ts'
import type { OpenApiPathsDto } from '../../app/http/documentation/dto.ts'
import { templateListResponseSchema } from './schemas.ts'
export const createNotificationDocumentation = (): OpenApiPathsDto => ({
  '/notifications/templates': {
    get: operation({
      operationId: 'listEmailTemplates',
      summary: 'List registered email templates',
      description:
        'Returns template keys, supported languages, and default languages. Does not expose HTML, translation dictionaries, recipients, filesystem paths, or queued jobs. Template folders use kebab-case; service keys remain camelCase. Generic sending and queue administration are server-side operations.',
      tag: 'Notifications',
      access: 'authenticated',
      response: templateListResponseSchema,
      messageKey: 'notifications.templates_listed'
    })
  }
})
