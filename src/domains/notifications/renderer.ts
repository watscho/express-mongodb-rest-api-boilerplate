import { createInstance } from 'i18next'
import ejs from 'ejs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { notificationEnv as env } from '../../app/config/notifications.ts'
import { projectRoot, resolveWithinRoot } from '../../app/runtime/paths.ts'
import { AppError } from '../../app/http/errors.ts'
import { getEmailTemplate, getRegisteredEmailTemplates } from './registry.ts'
import { renderedNotificationSchema } from './schemas.ts'
import { prepareNotification } from './preparation.ts'
import type { RenderedNotificationDto, TemplateVariablesDto } from './dto.ts'

const templatesRoot = env.MAIL_TPL_PATH
  ? resolve(projectRoot, env.MAIL_TPL_PATH)
  : fileURLToPath(new URL('./templates/', import.meta.url))

const resolveTemplatePath = (file: string) => {
  try {
    return resolveWithinRoot(templatesRoot, file)
  } catch {
    throw new AppError(500, 'notifications.invalid_template_path')
  }
}

export const initializeMailTemplates = async (): Promise<void> => {
  const files = getRegisteredEmailTemplates().flatMap(template => [
    template.htmlFile,
    ...(template.textFile ? [template.textFile] : [])
  ])
  await Promise.all(
    files.map(async file => {
      if (!(await stat(resolveTemplatePath(file))).isFile()) {
        throw new AppError(500, 'notifications.invalid_template_path')
      }
    })
  )
}

export const renderNotification = async (
  input: unknown
): Promise<RenderedNotificationDto> => {
  const notification = prepareNotification(input)
  const template = getEmailTemplate(notification.template)
  const translations = Object.fromEntries(
    Object.entries(template.translations).map(([locale, dictionary]) => [
      locale,
      { ...dictionary }
    ])
  )
  for (const [locale, dictionary] of Object.entries(
    notification.translations ?? {}
  )) {
    translations[locale] = { ...translations[locale], ...dictionary }
  }
  const language = notification.language
  const translator = createInstance()
  // A render-local instance prevents per-message overrides from changing other emails.
  await translator.init({
    lng: language,
    fallbackLng: template.defaultLanguage,
    ns: ['email'],
    defaultNS: 'email',
    keySeparator: false,
    nsSeparator: false,
    resources: Object.fromEntries(
      Object.entries(translations).map(([locale, copy]) => [
        locale,
        { email: copy }
      ])
    ),
    interpolation: { escapeValue: false }
  })
  const clientUrl = env.CLIENT_URL.replace(/\/$/, '')
  const accessToken = notification.variables.accessToken
  const actionUrl =
    template.actionPath && typeof accessToken === 'string'
      ? `${clientUrl}/${template.actionPath}/${encodeURIComponent(accessToken)}`
      : undefined
  const t = (key: string, values: TemplateVariablesDto = {}): string => {
    if (!translator.exists(key))
      throw new AppError(500, 'notifications.translation_not_found')
    return translator.t(key, {
      values: {
        ...notification.variables,
        ...values,
        clientUrl,
        actionUrl: actionUrl ?? '',
        email: notification.email
      },
      returnObjects: false
    })
  }
  const locals = {
    data: notification.variables,
    t,
    language,
    clientUrl,
    actionUrl,
    direction: ['ar', 'he', 'fa', 'ur'].includes(language.split('-')[0]!)
      ? 'rtl'
      : 'ltr'
  }
  const options = { cache: env.NODE_ENV === 'production' }
  const html = await ejs.renderFile(
    resolveTemplatePath(template.htmlFile),
    locals,
    options
  )
  const text = template.textFile
    ? await ejs.renderFile(
        resolveTemplatePath(template.textFile),
        locals,
        options
      )
    : t(template.textKey)
  const rendered = renderedNotificationSchema.safeParse({
    email: notification.email,
    template: template.key,
    language,
    subject: t(template.subjectKey),
    html,
    text
  })
  if (!rendered.success)
    throw new AppError(500, 'notifications.invalid_rendered_content')
  return rendered.data
}
