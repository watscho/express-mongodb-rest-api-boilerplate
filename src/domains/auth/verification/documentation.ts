import { operation } from '../../../app/http/documentation/utils.ts'
import type { OpenApiPathsDto } from '../../../app/http/documentation/dto.ts'
import {
  accessTokenSchema,
  emailRequestSchema,
  tokenParamsSchema
} from '../schemas.ts'

export const createVerificationDocumentation = (): OpenApiPathsDto => ({
  '/user/verification/request': {
    post: operation({
      operationId: 'requestEmailVerification',
      summary: 'Request email verification',
      description:
        'Accepts only the authenticated account’s current email. Replaces previous verification tokens, cancels obsolete queued links, and queues a new link valid for seven days from issuance. Already verified accounts may request a new link too.',
      tag: 'Verification',
      access: 'authenticated',
      body: emailRequestSchema,
      emailLanguage: true,
      messageKey: 'auth.verification_requested'
    })
  },
  '/user/verification/{accessToken}': {
    get: operation({
      operationId: 'verifyEmail',
      summary: 'Confirm email ownership',
      description:
        'Consumes a single-use verification token, marks the current address verified, invalidates earlier account JWTs, and returns a replacement JWT. This legacy GET changes state, and Express dispatches HEAD to it too; do not probe/prefetch the URL or record it in analytics.',
      tag: 'Verification',
      access: 'public',
      params: tokenParamsSchema,
      response: accessTokenSchema,
      emailLanguage: true,
      messageKey: 'auth.email_verified',
      errors: [403]
    })
  }
})
