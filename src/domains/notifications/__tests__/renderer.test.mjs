import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { replace } from '../../../__tests__/helpers.mjs'
const dir = await mkdtemp(join(tmpdir(), 'unit-templates-'))
after(() => rm(dir, { recursive: true, force: true }))
await writeFile(
  join(dir, 'html.ejs'),
  '<div dir="<%= direction %>"><%= t("body") %></div>'
)
await mkdir(join(dir, 'directory'))
const env = {
  MAIL_TPL_PATH: dir,
  CLIENT_URL: 'http://client/',
  MAIL_DEFAULT_LANGUAGE: 'en',
  NODE_ENV: 'production'
}
let template = {
  key: 'unit',
  htmlFile: 'html.ejs',
  subjectKey: 'subject',
  textKey: 'text',
  defaultLanguage: 'en',
  translations: { en: { subject: 'Unit', body: 'Body', text: 'Text' } },
  variablesSchema: z.object({})
}
replace('app/config/notifications.js', { notificationEnv: env })
replace('domains/notifications/registry.js', {
  getEmailTemplate: () => template,
  getRegisteredEmailTemplates: () => [template]
})
const { renderNotification, initializeMailTemplates } =
  await import('../../../../dist/domains/notifications/renderer.js')
const input = { email: 'unit@example.test', template: 'unit' }
test('custom templates support text dictionary fallback and RTL languages', async () => {
  await initializeMailTemplates()
  assert.equal((await renderNotification(input)).text, 'Text')
  template = {
    ...template,
    defaultLanguage: 'ar',
    translations: { ar: { subject: 'Subject', body: 'Body', text: 'Text' } }
  }
  assert(
    (await renderNotification({ ...input, language: 'ar' })).html.includes(
      'rtl'
    )
  )
})
test('template directories and missing translation keys fail safely', async () => {
  template = { ...template, htmlFile: 'directory' }
  await assert.rejects(() => initializeMailTemplates(), {
    messageKey: 'notifications.invalid_template_path'
  })
  template = {
    ...template,
    htmlFile: 'html.ejs',
    translations: { ar: { subject: 'Subject', text: 'Text' } }
  }
  await assert.rejects(() => renderNotification({ ...input, language: 'ar' }), {
    messageKey: 'notifications.translation_not_found'
  })
})
test('invalid rendered subject is rejected at output boundary', async () => {
  template = {
    ...template,
    translations: { ar: { subject: 'Bad\nHeader', body: 'Body', text: 'Text' } }
  }
  await assert.rejects(() => renderNotification({ ...input, language: 'ar' }), {
    messageKey: 'notifications.invalid_rendered_content'
  })
})
