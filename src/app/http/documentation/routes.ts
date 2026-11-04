import { Router } from 'express'
import type { RequestHandler } from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import helmet from 'helmet'
import { apiEnv } from '../../config/api.ts'
import { createOpenApiDocument } from './document.ts'
import { createErrorResponse } from '../response.ts'

const digest = (value: string) => createHash('sha256').update(value).digest()
const docsAuth: RequestHandler = (req, res, next) => {
  if (!apiEnv.DOCS_USERNAME || !apiEnv.DOCS_PASSWORD) {
    next()
    return
  }
  const encoded = req
    .get('Authorization')
    ?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i)?.[1]
  const credentials = encoded
    ? Buffer.from(encoded, 'base64').toString('utf8')
    : ''
  const expected = `${apiEnv.DOCS_USERNAME}:${apiEnv.DOCS_PASSWORD}`
  if (!timingSafeEqual(digest(credentials), digest(expected))) {
    res.setHeader(
      'WWW-Authenticate',
      'Basic realm="API documentation", charset="UTF-8"'
    )
    res.status(401).json(createErrorResponse(401))
    return
  }
  next()
}

const initializer = `window.addEventListener('load', async () => {
  const [config, spec] = await Promise.all([
    fetch('./config.json', { credentials: 'same-origin' }).then(response => { if (!response.ok) throw new Error('Cannot load documentation configuration'); return response.json(); }),
    fetch('./openapi.json', { credentials: 'same-origin' }).then(response => { if (!response.ok) throw new Error('Cannot load OpenAPI document'); return response.json(); })
  ]);
  SwaggerUIBundle({ ...config, spec, dom_id: '#swagger-ui',
    requestInterceptor: request => { request.credentials = 'omit'; return request; }
  });
});`
const html =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>API reference — Swagger UI</title><link rel="stylesheet" href="./swagger-ui.css"><link rel="icon" href="data:,"></head><body><div id="swagger-ui"></div><script src="./swagger-ui-bundle.js"></script><script src="./initializer.js"></script></body></html>'

export const createDocumentationRouter = () => {
  const router = Router({ strict: true })
  if (!apiEnv.DOCS_ENABLED) return router
  const require = createRequire(import.meta.url)
  const assets = dirname(require.resolve('swagger-ui-dist/package.json'))
  const spec = createOpenApiDocument(new URL(apiEnv.APP_URL).pathname)
  const sendSpecification: RequestHandler = (_req, res) => {
    res.json(spec)
  }
  router.use(['/docs', '/openapi.json'], docsAuth)
  router.get('/openapi.json', sendSpecification)
  router.get('/docs', (_req, res) => {
    res.redirect(308, './docs/')
  })
  const docs = Router()
  docs.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: apiEnv.NODE_ENV === 'production' ? [] : null
      }
    })
  )
  docs.get('/', (_req, res) => {
    res.type('html').send(html)
  })
  docs.get('/initializer.js', (_req, res) => {
    res.type('application/javascript').send(initializer)
  })
  docs.get('/config.json', (_req, res) => {
    res.json({
      deepLinking: true,
      persistAuthorization: false,
      validatorUrl: null,
      queryConfigEnabled: false,
      withCredentials: false,
      displayRequestDuration: true,
      defaultModelsExpandDepth: 1,
      supportedSubmitMethods: apiEnv.DOCS_TRY_IT_OUT_ENABLED
        ? ['get', 'post']
        : [],
      tryItOutEnabled: false,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    })
  })
  docs.get('/openapi.json', sendSpecification)
  for (const filename of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
    docs.get(`/${filename}`, (_req, res) => {
      res.sendFile(join(assets, filename))
    })
  }
  router.use('/docs/', docs)
  return router
}
