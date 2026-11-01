import { notificationEnv as env } from '../../app/config/notifications.ts'
import { AppError } from '../../app/http/errors.ts'
import { toValidationIssueDto } from '../../app/http/transformer.ts'
import { getEmailTemplate } from './registry.ts'
import { notificationSchema } from './schemas.ts'
import { resolveEmailLanguage } from './utils.ts'
import type { PreparedNotificationDto } from './dto.ts'

export const prepareNotification = (
  input: unknown
): PreparedNotificationDto => {
  const parsed = notificationSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError(
      400,
      'notifications.invalid_request',
      parsed.error.issues.map(toValidationIssueDto)
    )
  }
  const notification = parsed.data
  const template = getEmailTemplate(notification.template)
  const variables = template.variablesSchema.safeParse(notification.variables)
  if (!variables.success) {
    throw new AppError(
      400,
      'notifications.invalid_variables',
      variables.error.issues.map(toValidationIssueDto)
    )
  }
  return {
    ...notification,
    variables: variables.data,
    language: resolveEmailLanguage(
      notification.language,
      [
        ...new Set([
          ...Object.keys(template.translations),
          ...Object.keys(notification.translations ?? {})
        ])
      ],
      env.MAIL_DEFAULT_LANGUAGE,
      template.defaultLanguage
    )
  }
}
