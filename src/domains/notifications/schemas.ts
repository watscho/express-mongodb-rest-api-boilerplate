import { z } from 'zod'
import { objectIdSchema } from '../users/schemas.ts'

export const accountTemplateSchema = z.enum([
  'signUp',
  'resetPassword',
  'verification',
  'successfullyVerified',
  'successfullyUpdatedProfile',
  'successfullyUpdatedPassword',
  'successfullyUpdatedEmail',
  'successfullyDeleted'
])

const notificationTemplateSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
const emailLanguageSchema = z
  .string()
  .min(2)
  .max(64)
  .refine(value => {
    try {
      return Intl.getCanonicalLocales(value).length === 1
    } catch {
      return false
    }
  }, 'notifications.invalid_language')
  .transform(value => Intl.getCanonicalLocales(value)[0] ?? value)
export const emailTranslationsSchema = z.record(
  emailLanguageSchema,
  z.record(z.string().min(1), z.string())
)
export const templateVariablesSchema = z.record(z.string(), z.json())
export const notificationSchema = z.object({
  email: z.email(),
  template: notificationTemplateSchema,
  language: z.string().max(1024).optional(),
  variables: templateVariablesSchema.default({}),
  translations: emailTranslationsSchema.optional()
})
export const preparedNotificationSchema = notificationSchema.extend({
  language: emailLanguageSchema
})
export const accountNotificationSchema = notificationSchema
  .pick({ email: true, language: true })
  .extend({
    accessToken: z.string().optional(),
    ownerId: objectIdSchema,
    expiresAt: z.date().optional()
  })
export const emailTemplateSchema = z
  .object({
    key: notificationTemplateSchema,
    htmlFile: z.string().min(1),
    textFile: z.string().min(1).optional(),
    subjectKey: z.string().min(1).default('subject'),
    textKey: z.string().min(1).default('text'),
    defaultLanguage: emailLanguageSchema.default('en'),
    actionPath: z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9/-]*$/)
      .optional(),
    translations: emailTranslationsSchema
  })
  .superRefine((template, ctx) => {
    const fallback = template.translations[template.defaultLanguage]
    if (
      !fallback ||
      !fallback[template.subjectKey]?.trim() ||
      (!template.textFile && !fallback[template.textKey]?.trim())
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'notifications.missing_default_translations'
      })
    }
  })
export const templateSummarySchema = z.object({
  key: notificationTemplateSchema,
  // Catalog values are already canonical; the response describes strings, not normalization.
  languages: z.array(emailLanguageSchema.in),
  defaultLanguage: emailLanguageSchema.in
})
export const templateListResponseSchema = z.object({
  templates: z.array(templateSummarySchema)
})
export const renderedNotificationSchema = notificationSchema
  .pick({ email: true, template: true })
  .extend({
    language: emailLanguageSchema,
    subject: z
      .string()
      .min(1)
      .max(998)
      .regex(/^[^\r\n]+$/),
    html: z
      .string()
      .min(1)
      .max(1024 * 1024),
    text: z
      .string()
      .min(1)
      .max(256 * 1024)
  })
export const mailMessageSchema = z.object({
  messageId: z.string().optional(),
  from: z.string(),
  to: notificationSchema.shape.email,
  subject: renderedNotificationSchema.shape.subject,
  html: z.string().min(1),
  text: z.string().min(1)
})
