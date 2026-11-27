// Deathloom fork (S3): market history watchlist storage cap
import test from 'node:test'
import assert from 'node:assert/strict'

const wl = await import('./.build/watchlist-store.mjs')
const H = 60 * 60_000
const D = 24 * H
const NOW = Date.UTC(2026, 10, 27, 12)
const item = (key, points = [], alert) => ({ key, ns: 'currency', name: key, label: key, league: 'L', addedAt: 0, points, ...(alert ? { alert } : {}) })

test('watchlist (S3): at most 50 items', () => {
  assert.equal(wl.MAX_ITEMS, 50)
  assert.equal(wl.canAdd(Array.from({ length: 49 }, (_, i) => item(`i${i}`))), true)
  assert.equal(wl.canAdd(Array.from({ length: 50 }, (_, i) => item(`i${i}`))), false)
})

test('watchlist (S3): points older than 14 days thin to one a day, newer stay hourly', () => {
  const hourly = []
  for (let t = NOW - 30 * D; t <= NOW; t += H) hourly.push([t, t / H])
  const thin = wl.thinPoints(hourly, NOW)
  const cutoff = NOW - 14 * D
  const old = thin.filter(p => p[0] < cutoff)
  const recent = thin.filter(p => p[0] >= cutoff)
  assert.equal(recent.length, hourly.filter(p => p[0] >= cutoff).length, 'last 14 days untouched')
  const days = old.map(p => Math.floor(p[0] / D))
  assert.equal(new Set(days).size, days.length, 'one point per old day')
  assert.equal(days.length, 17, 'days -30 to -14 (both partial, noon to noon)')
  // the kept one is the last of its day
  assert.equal(old[0][0], Math.floor(hourly[0][0] / D) * D + 23 * H)
  assert.ok(thin.length < 400, `${thin.length} points instead of ${hourly.length}`)
  // nothing old: same array (no needless save)
  const fresh = hourly.filter(p => p[0] >= cutoff)
  assert.equal(wl.thinPoints(fresh, NOW), fresh)
  assert.equal(wl.thinPoints(thin, NOW), thin, 'already thin: unchanged')
})

test('watchlist (S3): 50 items with 4 months of history fit well under 5 MB', () => {
  const list = Array.from({ length: 50 }, (_, i) => {
    const pts = []
    for (let t = NOW - 120 * D; t <= NOW; t += H) pts.push([t, 123.45 + i])
    return item(`League|currency|Item ${i}|`, wl.thinPoints(pts, NOW))
  })
  const bytes = JSON.stringify(list).length * 2 // localStorage counts UTF-16
  assert.ok(bytes < 2_000_000, `${bytes} bytes`)
})

test('watchlist (S3): one pass records, thins and checks alerts', () => {
  const list = [
    item('a', [[NOW - 2 * H, 10]]),
    item('b', [[NOW - 10 * 60_000, 10]], { pct: 10, base: 10 }),
    item('c', [], { pct: 50, base: 10 })
  ]
  const { changed, alerts } = wl.applyPrices(list, [{ key: 'a', chaos: 11 }, { key: 'b', chaos: 12 }, { key: 'c', chaos: 12 }, { key: 'gone', chaos: 1 }], NOW)
  assert.equal(changed, true)
  assert.deepEqual(list[0].points.at(-1), [NOW, 11], 'old enough: point added')
  assert.equal(list[1].points.length, 1, 'recorded 10 min ago: no new point')
  assert.deepEqual(alerts.map(a => a.key), ['b'], 'b moved 20% (alert 10%), c only 20% (alert 50%)')
  assert.equal(Math.round(alerts[0].change), 20)
  assert.equal(list[1].alert.base, 12, 'alert base moves on')
  // again right away: nothing to save
  assert.deepEqual(wl.applyPrices(list, [{ key: 'a', chaos: 11 }, { key: 'b', chaos: 12 }], NOW + 1000), { changed: false, alerts: [] })
})
