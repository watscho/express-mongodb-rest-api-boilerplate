import { operation } from '../../app/http/documentation/utils.ts'
import type { OpenApiPathsDto } from '../../app/http/documentation/dto.ts'
import { createVerificationDocumentation } from './verification/documentation.ts'
import {
  credentialsSchema,
  signUpSchema,
  emailRequestSchema,
  newPasswordSchema,
  updatePasswordSchema,
  deleteProfileSchema,
  accessTokenSchema,
  updateEmailResponseSchema,
  tokenParamsSchema
} from './schemas.ts'

export const createAuthDocumentation = (): OpenApiPathsDto => {
  const signOut = operation({
    operationId: 'signOut',
    summary: 'Revoke the current bearer token',
    description:
      'Stores the token digest in Redis until its JWT expiry. Does not revoke every session for the account.',
    tag: 'Authentication',
    access: 'authenticated',
    messageKey: 'auth.signed_out'
  })
  return {
    '/auth/sign-in': {
      post: operation({
        operationId: 'signIn',
        summary: 'Sign in',
        description:
          'Returns an HS256 bearer JWT. Passwords are 6–48 characters and at most 72 UTF-8 bytes when created; sign-in accepts existing credentials without reapplying creation policy.',
        tag: 'Authentication',
        access: 'guest',
        body: credentialsSchema,
        response: accessTokenSchema,
        messageKey: 'auth.signed_in'
      })
    },
    '/auth/sign-up': {
      post: operation({
        operationId: 'signUp',
        summary: 'Create an account',
        description:
          'Creates an unverified account and queues welcome/verification emails. Emails are trimmed/lowercased without provider-specific alias rewriting. Passwords must be 6–48 characters and at most 72 UTF-8 bytes.',
        tag: 'Authentication',
        access: 'guest',
        body: signUpSchema,
        response: accessTokenSchema,
        messageKey: 'auth.signed_up',
        emailLanguage: true,
        errors: [409]
      })
    },
    '/auth/sign-out': {
      post: signOut,
      get: {
        ...signOut,
        operationId: 'legacySignOut',
        summary: 'Legacy sign-out',
        description:
          'Compatibility endpoint with the same state-changing behavior as POST. Express also dispatches HEAD to this handler. Do not probe/prefetch it; use POST in new integrations.',
        deprecated: true
      }
    },
    '/auth/password/reset': {
      post: operation({
        operationId: 'requestPasswordReset',
        summary: 'Request password reset',
        description:
          'Returns the same success envelope whether the email exists. For an existing account, replaces previous reset tokens and queues a single-use link valid for one day from issuance.',
        tag: 'Password',
        access: 'guest',
        body: emailRequestSchema,
        messageKey: 'auth.password_reset_requested',
        emailLanguage: true
      })
    },
    '/auth/password/new/{accessToken}': {
      post: operation({
        operationId: 'resetPassword',
        summary: 'Consume a password-reset link',
        description:
          'Consumes the token atomically, updates the password, invalidates earlier account JWTs and security-link tokens, and returns a replacement JWT. Save it before the next authenticated request. New passwords must also fit bcrypt’s 72-byte UTF-8 limit.',
        tag: 'Password',
        access: 'public',
        body: newPasswordSchema,
        response: accessTokenSchema,
        params: tokenParamsSchema,
        emailLanguage: true,
        messageKey: 'auth.password_updated',
        errors: [403]
      })
    },
    '/user/update/email': {
      post: operation({
        operationId: 'updateEmail',
        summary: 'Change account email',
        description:
          'Requires the current password. A changed address becomes unverified, prior account JWTs are invalidated, the old address receives a security notification, and the new address receives verification. accessToken is present only when the email changed.',
        tag: 'Account',
        access: 'authenticated',
        body: credentialsSchema,
        response: updateEmailResponseSchema,
        emailLanguage: true,
        messageKey: 'auth.email_update_completed',
        errors: [403, 409]
      })
    },
    '/user/update/password': {
      post: operation({
        operationId: 'updatePassword',
        summary: 'Change account password',
        description:
          'Confirms the old password, invalidates previous JWTs and security-link tokens, and returns a replacement JWT. Save it before further authenticated calls. The new password has a 72-byte UTF-8 limit.',
        tag: 'Password',
        access: 'authenticated',
        body: updatePasswordSchema,
        response: accessTokenSchema,
        emailLanguage: true,
        messageKey: 'auth.password_updated',
        errors: [403]
      })
    },
    '/user/delete': {
      post: operation({
        operationId: 'deleteAccount',
        summary: 'Delete the authenticated account',
        description:
          'Requires the current password. Deletes account, token, and owned-media records transactionally; cancels earlier unsent notifications and queues a deletion notice. Filesystem cleanup follows commit and is best effort.',
        tag: 'Account',
        access: 'authenticated',
        body: deleteProfileSchema,
        emailLanguage: true,
        messageKey: 'users.profile_deleted',
        errors: [403]
      })
    },
    ...createVerificationDocumentation()
  }
}
