import i18next from 'i18next'
import i18nextHttpMiddleware from 'i18next-http-middleware'

import translationEn from './translations/en.json'
import translationKa from './translations/ka.json'

i18next.use(i18nextHttpMiddleware.LanguageDetector).init({
  detection: {
    order: ['header'],
    lookupHeader: 'accept-language'
  },
  preload: ['en', 'ka'],
  fallbackLng: 'en',
  resources: {
    en: { translation: translationEn },
    ka: { translation: translationKa }
  }
})

export { i18next, i18nextHttpMiddleware }
