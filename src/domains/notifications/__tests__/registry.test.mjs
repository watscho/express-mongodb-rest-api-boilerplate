import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  registerEmailTemplate,
  getEmailTemplate
} from '../../../../dist/domains/notifications/registry.js'
const definition = {
  key: 'unit',
  htmlFile: 'unit.ejs',
  translations: { en: { subject: 'Unit', text: 'Text' } },
  variablesSchema: z.object({})
}
test('regional and unknown locale layouts follow fallback chain', () => {
  for (const [key, defaultLanguage, translations] of [
    [
      'regional',
      'en',
      {
        en: { subject: 'Unit', text: 'Text' },
        'ka-GE': { subject: 'Unit', text: 'Text' }
      }
    ],
    [
      'default',
      'ka',
      {
        ka: { subject: 'Unit', text: 'Text' },
        fr: { subject: 'Unit', text: 'Text' }
      }
    ],
    ['english', 'fr', { fr: { subject: 'Unit', text: 'Text' } }]
  ]) {
    registerEmailTemplate({ ...definition, key, defaultLanguage, translations })
    assert(
      getEmailTemplate(key).translations[Object.keys(translations).at(-1)]
        .subject
    )
  }
})
test('template replacement is explicit and variables schema is required', () => {
  registerEmailTemplate(definition)
  registerEmailTemplate(
    {
      ...definition,
      translations: { en: { subject: 'Updated', text: 'Text' } }
    },
    { replace: true }
  )
  assert.equal(getEmailTemplate('unit').translations.en.subject, 'Updated')
  for (const variablesSchema of [undefined, {}])
    assert.throws(
      () =>
        registerEmailTemplate({
          ...definition,
          key: 'invalid',
          variablesSchema
        }),
      { messageKey: 'notifications.invalid_template_definition' }
    )
})
test('template language and required default translations are validated', () => {
  for (const translations of [
    { xx_YY: { subject: 'Unit', text: 'Text' } },
    { en: {} },
    { en: { subject: 'Unit' } }
  ])
    assert.throws(
      () =>
        registerEmailTemplate({ ...definition, key: 'invalid', translations }),
      { messageKey: 'notifications.invalid_template_definition' }
    )
})
