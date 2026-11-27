// Deathloom fork (Q29): league recap card (farming runs, ledger, pace runs, ticks).
import test from 'node:test'
import assert from 'node:assert/strict'
const lr = await import('./.build/league-recap.mjs')

const DAY = 86_400_000
const T0 = Date.UTC(2026, 10, 1)
const H = 3_600_000
const run = (i, strategy, loot, league = 'Covens', mechanics = ['Breach']) =>
  ({ id: `r${i}`, league, strategy, mechanics, loot, cost: 10, ms: H / 6, at: T0 + 2 * DAY + i * H })
const runs = [
  ...Array.from({ length: 6 }, (_, i) => run(i, 'Breach juice', 110)),
  ...Array.from({ length: 5 }, (_, i) => run(10 + i, 'Alch and go', 40, 'Covens', ['Ritual', 'Breach'])),
  run(99, 'Old', 1000, 'Mercenaries')
]
const trade = (direction, price, at, league = 'Covens') => ({ id: price + at, at, direction, char: 'x', item: 'y', price, league })
const ledger = [trade('from', '5 chaos', T0 + 3 * DAY), trade('from', '1,5 divine', T0 + 4 * DAY), trade('from', '10 chaos', T0 + 5 * DAY), trade('to', '2 chaos', T0 + 5 * DAY), trade('from', '99 chaos', T0, 'Mercenaries')]
const pace = (name, startAt, level, deaths) => ({ id: name, name, cls: 'Witch', startAt, updatedAt: startAt + DAY, splits: {}, actMs: {}, deaths, deathsByAct: {}, levelAt: {}, level, campaignMs: 5 * H, endgame: level > 68 })
const paceRuns = [pace('Main', T0, 92, 7), pace('Alt', T0 + 3 * DAY, 70, 2), pace('LastLeague', T0 - 90 * DAY, 95, 30)]
const progress = [{ title: 'Atlas', items: [{ id: 'void1', label: 'Voidstone 1' }, { id: 'void2', label: 'Voidstone 2' }] },
  { title: 'Pinnacle bosses', items: [{ id: 'exarch', label: 'The Searing Exarch' }, { id: 'sirus', label: 'Sirus' }] }]

const input = { league: 'Covens', farmRuns: runs, ledger, paceRuns, progress, progressTicks: new Set(['void1', 'void2', 'exarch']), challengesDone: 12, challengesTotal: 40 }

test('league recap: only this league\'s runs and trades', () => {
  const r = lr.leagueRecap(input)
  assert.equal(r.maps, 11)
  assert.equal(r.profit, 6 * 100 + 5 * 30)
  assert.ok(Math.abs(r.mapHours - 11 / 6) < 1e-9)
  assert.equal(r.sales, 3); assert.equal(r.purchases, 1)
  assert.deepEqual(r.sold, [{ currency: 'chaos', amount: 15 }, { currency: 'divine', amount: 1.5 }])
  assert.equal(r.bestStrategy.name, 'Breach juice')
  assert.equal(r.topMechanic.name, 'Breach'); assert.equal(r.topMechanic.maps, 11)
})

test('league recap: characters from the league window, bosses and voidstones from ticks', () => {
  const r = lr.leagueRecap(input)
  assert.deepEqual(r.characters.map(c => c.name), ['Main', 'Alt'], 'old league character left out, highest level first')
  assert.equal(r.deaths, 9)
  assert.deepEqual(r.pinnacles, ['The Searing Exarch'])
  assert.equal(r.voidstones, 2)
  assert.equal(r.from, T0)
  assert.ok(r.days >= 5)
  assert.equal(r.empty, false)
})

test('league recap: empty league, too few maps for a best strategy', () => {
  const e = lr.leagueRecap({ ...input, league: 'Nope', progressTicks: new Set(), challengesDone: 0 })
  assert.equal(e.empty, true); assert.equal(e.maps, 0); assert.equal(e.days, 0); assert.deepEqual(e.characters, [])
  const few = lr.leagueRecap({ ...input, farmRuns: runs.slice(0, 3) })
  assert.equal(few.bestStrategy, undefined)
})

test('league recap: copied text', () => {
  const t = lr.recapText(lr.leagueRecap(input))
  assert.match(t, /^Covens league recap/)
  assert.match(t, /Characters: Main \(Witch level 92\), Alt/)
  assert.match(t, /Maps: 11 in 1\.8 h, profit 750c/)
  assert.match(t, /Trades: 3 sold, 1 bought; sold for 15 chaos, 1\.5 divine/)
  assert.match(t, /Bosses: The Searing Exarch/)
  assert.match(t, /Challenges: 12\/40/)
  assert.doesNotMatch(t, /https?:/)
  assert.equal(lr.fmtHours(90 * 60_000), '1h 30m')
})
