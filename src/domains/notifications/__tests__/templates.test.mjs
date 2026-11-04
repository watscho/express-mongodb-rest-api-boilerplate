import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { prepareNotification } from '../../../../dist/domains/notifications/preparation.js'
import {
  renderNotification,
  initializeMailTemplates
} from '../../../../dist/domains/notifications/renderer.js'
import {
  listEmailTemplates,
  registerEmailTemplate,
  getEmailTemplate
} from '../../../../dist/domains/notifications/registry.js'

const notification = {
  email: 'unit@example.test',
  template: 'signUp',
  language: 'en',
  variables: {}
}

test('notification input and variables validated', () => {
  assert.throws(() => prepareNotification({ ...notification, email: 'bad' }), {
    messageKey: 'notifications.invalid_request'
  })
  assert.throws(
    () => prepareNotification({ ...notification, template: 'verification' }),
    { messageKey: 'notifications.invalid_variables' }
  )
  assert.throws(
    () => prepareNotification({ ...notification, template: 'unknown' }),
    { messageKey: 'notifications.template_not_found' }
  )
})

test('all registered templates render HTML/text in both languages', async () => {
  await initializeMailTemplates()
  for (const template of listEmailTemplates()) {
    for (const language of template.languages) {
      const result = await renderNotification({
        ...notification,
        template: template.key,
        language,
        variables: { accessToken: 'a'.repeat(96) }
      })
      assert(result.subject.length > 0)
      assert(result.text.length > 0)
      assert(result.html.includes('<'))
      assert.equal(result.language, language)
      if (['verification', 'resetPassword'].includes(template.key))
        assert(result.text.includes('a'.repeat(96)))
    }
  }
})

test('translations are isolated across concurrent renders', async () => {
  const [a, b] = await Promise.all([
    renderNotification({
      ...notification,
      translations: { en: { subject: 'Private override' } }
    }),
    renderNotification(notification)
  ])
  assert.equal(a.subject, 'Private override')
  assert.notEqual(b.subject, 'Private override')
})

test('template registration rejects duplicates, invalid definitions and traversal', async () => {
  assert.throws(
    () => registerEmailTemplate({ ...getEmailTemplate('signUp') }),
    { messageKey: 'notifications.template_already_registered' }
  )
  assert.throws(() => registerEmailTemplate({ key: 'bad' }), {
    messageKey: 'notifications.invalid_template_definition'
  })
  registerEmailTemplate({
    key: 'unitTraversal',
    htmlFile: '../escape.ejs',
    textFile: '../escape.txt',
    translations: { en: { subject: 'test', text: 'test' } },
    variablesSchema: z.object({})
  })
  await assert.rejects(
    () => renderNotification({ ...notification, template: 'unitTraversal' }),
    { messageKey: 'notifications.invalid_template_path' }
  )
})
