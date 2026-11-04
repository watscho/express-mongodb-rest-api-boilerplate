import { z } from 'zod'
import { AppError } from '../../app/http/errors.ts'
import { accountTemplateSchema, emailTemplateSchema } from './schemas.ts'
import type {
  EmailTemplateDto,
  RegisterTemplateDto,
  TemplateSummaryDto,
  EmailTranslationsDto,
  AccountTemplateDto
} from './dto.ts'
import en from './translations/en.json' with { type: 'json' }
import ka from './translations/ka.json' with { type: 'json' }

const templates = new Map<string, EmailTemplateDto>()
const layoutTranslations: EmailTranslationsDto = {
  en: en.layout,
  ka: ka.layout
}

export const registerEmailTemplate = (
  { variablesSchema, ...definition }: RegisterTemplateDto,
  options: { replace?: boolean } = {}
): void => {
  const result = emailTemplateSchema.safeParse(definition)
  if (
    !result.success ||
    !variablesSchema ||
    typeof variablesSchema.safeParse !== 'function'
  ) {
    throw new AppError(400, 'notifications.invalid_template_definition')
  }
  if (templates.has(result.data.key) && !options.replace) {
    throw new AppError(409, 'notifications.template_already_registered')
  }
  const translations = Object.fromEntries(
    Object.entries(result.data.translations).map(([language, dictionary]) => [
      language,
      {
        ...(layoutTranslations[language] ??
          layoutTranslations[language.split('-')[0]!] ??
          layoutTranslations[result.data.defaultLanguage] ??
          en.layout),
        ...dictionary
      }
    ])
  )
  templates.set(result.data.key, {
    ...result.data,
    translations,
    variablesSchema
  })
}

export const getEmailTemplate = (key: string): EmailTemplateDto => {
  const template = templates.get(key)
  if (!template) throw new AppError(404, 'notifications.template_not_found')
  return template
}

export const listEmailTemplates = (): TemplateSummaryDto[] =>
  Array.from(templates.values(), template => ({
    key: template.key,
    languages: Object.keys(template.translations),
    defaultLanguage: template.defaultLanguage
  }))

export const getRegisteredEmailTemplates = () => Array.from(templates.values())

const actionPaths: Partial<Record<AccountTemplateDto, string>> = {
  resetPassword: 'reset-password',
  verification: 'verification'
}

for (const key of accountTemplateSchema.options) {
  const actionPath = actionPaths[key]
  const folder = key.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase()
  registerEmailTemplate({
    key,
    htmlFile: `${folder}/html.ejs`,
    textFile: `${folder}/text.ejs`,
    actionPath,
    translations: { en: en[key], ka: ka[key] },
    variablesSchema: actionPath
      ? z.object({ accessToken: z.string().min(1) })
      : z.object({})
  })
}

// Register application-owned custom templates here, or during composition before startup.
