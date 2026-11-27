// Deathloom fork: PoE2 texts are added to the app's messages without copying them
// (beta.13 used structuredClone, which fails on vue-i18n's compiled messages).
import test from 'node:test'
import assert from 'node:assert/strict'

const { missingMessages } = await import('./.build/i18n.mjs')

test('i18n: only missing PoE2 texts are added; compiled/proxied messages are left alone', () => {
  const compiled = () => 'Search'
  const have = new Proxy({ app: { search: compiled, close: 'Close' }, item: { quality: 'Quality' } }, {})
  const extra = { app: { search: 'Search (PoE2)', thanks: 'Thanks' }, item: { quality: 'Q', spirit: 'Spirit' }, filters: { tag_rune: 'Rune' } }
  assert.doesNotThrow(() => structuredClone(missingMessages(have, extra)))
  assert.deepEqual(missingMessages(have, extra), {
    app: { thanks: 'Thanks' },
    item: { spirit: 'Spirit' },
    filters: { tag_rune: 'Rune' }
  })
  assert.throws(() => structuredClone(have)) // what beta.13 tripped on
})
