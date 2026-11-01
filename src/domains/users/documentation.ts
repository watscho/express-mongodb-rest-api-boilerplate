import { operation } from '../../app/http/documentation/utils.ts'
import type { OpenApiPathsDto } from '../../app/http/documentation/dto.ts'
import { userResponseSchema, updateProfileSchema } from './schemas.ts'
export const createUserDocumentation = (): OpenApiPathsDto => ({
  '/me': {
    get: operation({
      operationId: 'getCurrentUser',
      summary: 'Get current profile',
      description:
        'Returns public account fields and an optional owned avatar URL. Password hashes and account-version counters are omitted.',
      tag: 'Account',
      access: 'authenticated',
      response: userResponseSchema,
      messageKey: 'users.profile_loaded'
    })
  },
  '/user/update': {
    post: operation({
      operationId: 'updateProfile',
      summary: 'Update profile names',
      description:
        'Updates both names, each trimmed to 2–48 characters, and queues an account-change notification.',
      tag: 'Account',
      access: 'authenticated',
      body: updateProfileSchema,
      response: updateProfileSchema,
      emailLanguage: true,
      messageKey: 'users.profile_updated'
    })
  }
})
