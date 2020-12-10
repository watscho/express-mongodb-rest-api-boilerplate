const i18next = require('i18next')
const i18nextMiddleware = require('i18next-express-middleware')

const localeEN = require('@app/i18next/locales/en.json')
const localeGE = require('@app/i18next/locales/ge.json')

i18next.use(i18nextMiddleware.LanguageDetector).init({
  detection: {
    order: ['header'],
    lookupHeader: 'accept-language'
  },
  preload: ['en', 'ge'],
  whitelist: ['en', 'ge'],
  fallbackLng: 'en',
  resources: {
    en: { translation: localeEN },
    ge: { translation: localeGE }
  }
})

module.exports = { i18next, i18nextMiddleware }
