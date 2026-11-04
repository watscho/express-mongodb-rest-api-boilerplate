import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveEmailLanguage } from '../../../../dist/domains/notifications/utils.js'

for (const [pref, expected] of [
  ['ka-GE,en;q=0.7', 'ka'],
  ['en;q=0.3,ka;q=0.8', 'ka'],
  ['ka;q=0,en;q=1', 'en'],
  ['ka;q=2', 'en'],
  ['ka;q=NaN', 'en'],
  ['???', 'en'],
  ['*', 'en'],
  [undefined, 'en'],
  ['ka;q=.5,en;q=.5', 'ka']
])
  test(`locale negotiation ${pref}`, () =>
    assert.equal(
      resolveEmailLanguage(pref, ['en', 'ka'], 'en', 'en'),
      expected
    ))

test('language supports region-only availability and fallback', () => {
  assert.equal(resolveEmailLanguage('en', ['en-US'], 'ka', 'fallback'), 'en-US')
  assert.equal(resolveEmailLanguage('de', ['ka'], 'xx', 'fallback'), 'fallback')
})
