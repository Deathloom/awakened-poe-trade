// Deathloom fork (Q21): boss readiness card (saved PoB stats vs rule-of-thumb bars).
import test from 'node:test'
import assert from 'node:assert/strict'
const br = await import('./.build/boss-readiness.mjs')

const strong = {
  FullDPS: 5e6, FireResist: 76, ColdResist: 76, LightningResist: 76, ChaosResist: 30,
  PhysicalMaximumHitTaken: 9000, FireMaximumHitTaken: 12000, ColdMaximumHitTaken: 11000, LightningMaximumHitTaken: 11000, ChaosMaximumHitTaken: 8000
}
const exarch = br.BOSSES.find(b => b.id === 'exarch')

test('boss readiness: strong build is ready for a normal pinnacle', () => {
  const r = br.readiness(exarch, strong)
  assert.equal(r.verdict, 'ready')
  assert.ok(r.checks.every(c => c.ok === true))
})

test('boss readiness: low DPS or uncapped res', () => {
  const half = br.readiness(exarch, { ...strong, FullDPS: 1.5e6 })
  assert.equal(half.verdict, 'close')
  assert.equal(half.checks.find(c => c.id === 'dps').ok, false)
  const tiny = br.readiness(exarch, { ...strong, FullDPS: 5e5 })
  assert.equal(tiny.verdict, 'not')
  const res = br.readiness(exarch, { ...strong, ColdResist: 40 })
  assert.equal(res.verdict, 'not')
  assert.match(res.checks.find(c => c.id === 'res').have, /Cold 40%/)
})

test('boss readiness: max hit uses the weakest of the boss\'s hit types', () => {
  const r = br.readiness(exarch, { ...strong, PhysicalMaximumHitTaken: 4000, ChaosMaximumHitTaken: 100 })
  const hit = r.checks.find(c => c.id === 'hit')
  assert.equal(hit.ok, false, 'physical 4k < 7k')
  assert.match(hit.have, /physical/, 'chaos is not an Exarch hit type')
  assert.equal(r.verdict, 'not')
})

test('boss readiness: missing stats are unknown, not failures', () => {
  const r = br.readiness(exarch, { CombinedDPS: 3e6 })
  assert.equal(r.checks.find(c => c.id === 'dps').ok, true)
  assert.ok(r.checks.filter(c => c.id !== 'dps').every(c => c.ok === null))
  assert.equal(r.verdict, 'ready')
  assert.equal(br.readiness(exarch, {}).verdict, 'unknown')
  // DoT builds without FullDPS/CombinedDPS: hit + DoT
  assert.equal(br.buildDps({ TotalDPS: 1e6, TotalDotDPS: 2e6 }), 3e6)
  assert.equal(br.buildDps({ MinionDPS: 4e6 }), 4e6)
})

test('boss readiness: uber bars are higher; list split by tier; ids unique', () => {
  const normal = br.readinessAll(strong, false)
  const uber = br.readinessAll(strong, true)
  assert.ok(normal.length >= 7 && uber.length >= 6)
  assert.ok(normal.every(r => !r.boss.uber) && uber.every(r => r.boss.uber))
  assert.ok(uber.every(r => r.verdict !== 'ready'), '5M DPS is not uber-ready')
  const ids = br.BOSSES.map(b => b.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(br.fmtNum(2_500_000), '2.5M')
  assert.equal(br.fmtNum(7000), '7k')
})
