// Deathloom fork (S4): the price-check search cache key (object-hash replaced).
import test from 'node:test'
import assert from 'node:assert/strict'

const { cacheKey, Cache } = await import('./.build/trade-cache.mjs')

test('trade cache key: object key order does not matter, values do', () => {
  const a = { query: { status: { option: 'online' }, stats: [{ type: 'and', filters: [] }] }, sort: { price: 'asc' } }
  const b = { sort: { price: 'asc' }, query: { stats: [{ filters: [], type: 'and' }], status: { option: 'online' } } }
  assert.equal(cacheKey([a, 'Standard']), cacheKey([b, 'Standard']))
  assert.notEqual(cacheKey([a, 'Standard']), cacheKey([a, 'Hardcore']))
  assert.notEqual(cacheKey(['id1', 'id2']), cacheKey(['id2', 'id1']))
  assert.notEqual(cacheKey({ a: 1 }), cacheKey({ a: '1' }))
})

test('trade cache: get returns what set stored for an equal key', () => {
  const c = new Cache()
  c.set([{ x: 1, y: 2 }, 'L'], 'hit', 0.05)
  assert.equal(c.get([{ y: 2, x: 1 }, 'L']), 'hit')
  assert.equal(c.get([{ y: 2, x: 1 }, 'M']), undefined)
})
