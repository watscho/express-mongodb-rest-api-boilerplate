import type { z } from 'zod'
import type {
  accountTemplateSchema,
  notificationSchema,
  emailTranslationsSchema,
  templateVariablesSchema,
  emailTemplateSchema,
  templateSummarySchema,
  templateListResponseSchema,
  renderedNotificationSchema,
  mailMessageSchema,
  preparedNotificationSchema,
  accountNotificationSchema
} from './schemas.ts'

export type AccountTemplateDto = z.infer<typeof accountTemplateSchema>
export type PreparedNotificationDto = z.infer<typeof preparedNotificationSchema>
export type AccountNotificationDto = z.infer<typeof accountNotificationSchema>
export type SendTemplateDto = z.input<typeof notificationSchema>
export type EmailTranslationsDto = z.infer<typeof emailTranslationsSchema>
export type TemplateVariablesDto = z.infer<typeof templateVariablesSchema>
export type EmailTemplateDto = z.infer<typeof emailTemplateSchema> & {
  variablesSchema: z.ZodType<TemplateVariablesDto>
}
export type RegisterTemplateDto = z.input<typeof emailTemplateSchema> &
  Pick<EmailTemplateDto, 'variablesSchema'>
export type TemplateSummaryDto = z.infer<typeof templateSummarySchema>
export type TemplateListResponseDto = z.infer<typeof templateListResponseSchema>
export type RenderedNotificationDto = z.infer<typeof renderedNotificationSchema>
export type MailMessageDto = z.infer<typeof mailMessageSchema>
