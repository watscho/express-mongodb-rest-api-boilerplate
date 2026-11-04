import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { replace } from '../../../../__tests__/helpers.mjs'
import { request } from '../../../../__tests__/http.mjs'
const env = {
  DOCS_ENABLED: false,
  APP_URL: 'http://localhost:8000',
  NODE_ENV: 'development',
  DOCS_TRY_IT_OUT_ENABLED: false
}
replace('app/config/api.js', { apiEnv: env })
const { createDocumentationRouter } =
  await import('../../../../../dist/app/http/documentation/routes.js')
const app = () => express().use(createDocumentationRouter())
test('documentation disabled returns no routes', async () =>
  assert.equal((await request(app(), '/docs/')).status, 404))
test('documentation serves local UI assets specification initializer and config', async () => {
  env.DOCS_ENABLED = true
  const a = app()
  assert.equal((await request(a, '/docs')).status, 308)
  for (const path of [
    '/docs/',
    '/docs/initializer.js',
    '/docs/swagger-ui.css',
    '/docs/swagger-ui-bundle.js'
  ]) {
    const res = await request(a, path)
    assert.equal(res.status, 200, path)
    assert(res.text.length > 0)
  }
  assert.equal((await request(a, '/openapi.json')).body.openapi, '3.1.2')
  assert.equal((await request(a, '/docs/openapi.json')).body.openapi, '3.1.2')
  const res = await request(a, '/docs/config.json')
  assert.deepEqual(res.body.supportedSubmitMethods, [])
  assert.equal(res.body.validatorUrl, null)
})
test('docs basic auth rejects missing malformed and wrong credentials', async () => {
  env.DOCS_USERNAME = 'unit'
  env.DOCS_PASSWORD = 'secret'
  const a = app()
  for (const header of [
    undefined,
    'Bearer invalid',
    'Basic ' + Buffer.from('unit:wrong').toString('base64')
  ]) {
    const res = await request(a, '/openapi.json', {
      headers: header ? { authorization: header } : {}
    })
    assert.equal(res.status, 401)
    assert(res.headers['www-authenticate'].includes('Basic'))
  }
  const res = await request(a, '/openapi.json', {
    headers: {
      authorization: 'Basic ' + Buffer.from('unit:secret').toString('base64')
    }
  })
  assert.equal(res.status, 200)
})
test('production CSP and Try it out remain explicit', async () => {
  env.DOCS_USERNAME = 'unit'
  delete env.DOCS_PASSWORD
  env.NODE_ENV = 'production'
  env.DOCS_TRY_IT_OUT_ENABLED = true
  const res = await request(app(), '/docs/config.json')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.supportedSubmitMethods, ['get', 'post'])
  assert(
    res.headers['content-security-policy'].includes('upgrade-insecure-requests')
  )
})
