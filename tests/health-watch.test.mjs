// Deathloom fork (Q26): crash and slowness watch (ipc/health-watch.ts)
import test from 'node:test'
import assert from 'node:assert/strict'

const hw = await import('./.build/health-watch.mjs')
const NOW = Date.UTC(2026, 10, 27, 12)
const D = 24 * 3600_000

const s = (k, ms, extra = {}) => ({ k, ms, ok: true, at: NOW, ...extra })

test('cleanSample keeps known kinds and sane values only', () => {
  assert.equal(hw.cleanSample({ k: 'nope', ms: 1, ok: true }, NOW), null)
  assert.equal(hw.cleanSample({ k: 'trade-search', ms: -1, ok: true }, NOW), null)
  assert.equal(hw.cleanSample({ k: 'trade-search', ms: 'x', ok: true }, NOW), null)
  assert.equal(hw.cleanSample(null, NOW), null)
  const c = hw.cleanSample({ k: 'pob-call', ms: 12.6, ok: 1, what: 'load<script>"C:\\Users\\me"', extra: 1 }, NOW)
  assert.deepEqual(Object.keys(c).sort(), ['at', 'k', 'ms', 'ok', 'what'])
  assert.equal(c.ms, 13)
  assert.equal(c.ok, false, 'only true counts as ok')
  assert.ok(!/[<>"\\]/.test(c.what))
  assert.ok(c.what.length <= 40)
})

test('addSample drops samples older than 7 days and caps the count', () => {
  let list = [{ ...s('trade-search', 100), at: NOW - 8 * D }]
  list = hw.addSample(list, s('trade-search', 200), NOW)
  assert.equal(list.length, 1)
  for (let i = 0; i < hw.HEALTH_MAX_SAMPLES + 20; i++) list = hw.addSample(list, s('trade-fetch', i), NOW)
  assert.equal(list.length, hw.HEALTH_MAX_SAMPLES)
  assert.equal(list.at(-1).ms, hw.HEALTH_MAX_SAMPLES + 19)
})

test('readHealthState survives junk and keeps warnings on by default', () => {
  assert.deepEqual(hw.readHealthState('junk', NOW), { samples: [], warn: true })
  const st = hw.readHealthState({ warn: false, samples: [s('pob-start', 5000), { k: 'x' }, { ...s('pob-start', 1), at: NOW - 9 * D }, { ...s('pob-start', 1), at: NOW + 9 * D }] }, NOW)
  assert.equal(st.warn, false)
  assert.equal(st.samples.length, 1)
})

test('summarize: median, p90, slow and failed per kind', () => {
  const list = [1000, 2000, 3000, 4000, 20000].map(ms => s('pob-call', ms))
  list.push({ ...s('pob-call', 30000), ok: false, timeout: true })
  const sum = hw.summarize(list).find(x => x.k === 'pob-call')
  assert.equal(sum.count, 6)
  assert.equal(sum.fails, 1)
  assert.equal(sum.median, 3000)
  assert.equal(sum.max, 20000)
  assert.equal(sum.slow, 2)
  assert.equal(hw.summarize([]).length, hw.HEALTH_KINDS.length)
})

test('PoB load of a big build gets longer before it counts as slow', () => {
  assert.equal(hw.isSlow(s('pob-call', 30000, { what: 'load' })), false)
  assert.equal(hw.isSlow(s('pob-call', 30000, { what: 'impact' })), true)
})

test('healthHints: nothing for a healthy week', () => {
  const list = [s('pob-start', 8000), s('pob-call', 900), s('trade-search', 700), s('trade-fetch', 500)]
  assert.deepEqual(hw.healthHints(list), [])
})

test('healthHints: crashes, slow start, timeouts, slow trade site', () => {
  const list = [
    s('pob-crash', 0, { ok: false }), s('pob-crash', 0, { ok: false }),
    s('pob-start', 50000),
    s('pob-call', 30000, { ok: false, timeout: true, what: 'impact' }), s('pob-call', 30000, { ok: false, timeout: true }),
    s('trade-search', 9000), s('trade-search', 8000), s('trade-search', 7000)
  ]
  const kinds = hw.healthHints(list).map(h => h.k)
  assert.deepEqual(kinds, ['pob-crash', 'pob-start', 'pob-call', 'trade-search'])
  for (const h of hw.healthHints(list)) assert.ok(h.text && h.fix)
})

test('warnNow: crash, timeout, slow start, very slow answer only', () => {
  assert.ok(hw.warnNow(s('pob-crash', 0, { ok: false })))
  assert.ok(hw.warnNow(s('pob-call', 30000, { ok: false, timeout: true, what: 'impact' })).text.includes('impact'))
  assert.ok(hw.warnNow(s('pob-start', 45000)))
  assert.equal(hw.warnNow(s('pob-call', 20000, { what: 'impact' })), null)
  assert.ok(hw.warnNow(s('pob-call', 31000, { what: 'impact' })))
  assert.equal(hw.warnNow(s('trade-search', 60000)), null)
  assert.equal(hw.warnNow(s('pob-call', 500, { ok: false })), null)
})
