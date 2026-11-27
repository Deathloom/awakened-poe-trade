// Deathloom fork (Q12–Q14): 3.30 league planners (Viscera, Temple, Wombgifts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const viscera = await import('./.build/viscera.mjs')
const VISCERA = JSON.parse(readFileSync(join(root, 'renderer/src/web/money/viscera-data.json'), 'utf8'))

test('viscera data: every entry has a slot, tier, boss and mods', () => {
  assert.ok(VISCERA.length > 400)
  for (const v of VISCERA) {
    assert.ok(['head', 'body', 'arm', 'leg'].includes(v.slot), v.name)
    assert.ok([1, 2, 3].includes(v.tier), v.name)
    assert.ok(v.boss && v.base && v.mods.length, v.name)
  }
  const lesser = VISCERA.find(v => v.name === 'Lesser Scorched Arm')
  assert.equal(lesser.tier, 1)
  assert.equal(lesser.slot, 'arm')
})

test('viscera: browse filters by slot and words, cheapest first', () => {
  const prices = viscera.priceIndex([
    { category: 'viscera', name: 'Scorched Arm', chaos: 5 },
    { category: 'viscera', name: 'Lesser Scorched Arm', chaos: 2 },
    { category: 'viscera', name: 'Lesser Scorched Arm', chaos: 3 },
    { category: 'currency', name: 'Greater Scorched Arm', chaos: 1 }
  ])
  const priceOf = n => prices.get(n) ?? null
  assert.equal(priceOf('Lesser Scorched Arm'), 2)
  assert.equal(priceOf('Greater Scorched Arm'), null)
  const rows = viscera.browse(VISCERA, 'arm', 'ignite', priceOf)
  assert.deepEqual(rows.slice(0, 2).map(r => r.name), ['Lesser Scorched Arm', 'Scorched Arm'])
  assert.ok(rows.every(r => r.slot === 'arm'))
  assert.equal(viscera.browse(VISCERA, 'head', 'ignite fire fury', priceOf).length, 0)
})

test('viscera: plan steps say buy, farm or unknown and add up', () => {
  const priceOf = n => ({ 'Scorched Arm': 5, 'Lesser Scorched Arm': 2 })[n] ?? null
  const steps = viscera.planSteps([
    { slot: 'Arm', name: 'Scorched Arm' },
    { slot: 'Head', name: 'Greater Severed Rhoa Head' },
    { slot: 'Leg', name: 'Not A Viscera' },
    { slot: 'Weapon 1', name: 'Scorched Arm' }
  ], VISCERA, priceOf)
  assert.deepEqual(steps.map(s => s.how), ['buy', 'farm', 'unknown'])
  assert.equal(steps[0].others[0].name, 'Lesser Scorched Arm')
  assert.deepEqual(viscera.planCost(steps), { chaos: 5, unpriced: 2 })
})

const temple = await import('./.build/temple.mjs')
const ATZOATL = readFileSync(join(root, 'renderer/src/web/price-check/filters/pseudo/atzoatl-rules.ts'), 'utf8')

test('temple: every room name is a trade-site "Has Room" stat', () => {
  for (const l of temple.ROOM_LINES) {
    l.names.forEach((n, i) => {
      const esc = n.replace(/'/g, "\\'")
      assert.ok(ATZOATL.includes(`Has Room: ${esc} (Tier ${i + 1})`), n)
    })
  }
})

test('temple: upgrade order puts the best room closest to tier 3 first', () => {
  const order = temple.upgradeOrder({ packs: 2, corruption: 1, gems: 2, explosives: 1, currency: 3, items: 1 })
  assert.deepEqual(order.map(s => s.line.id), ['gems', 'corruption', 'packs', 'items', 'explosives'])
  assert.equal(order[0].next, 'Doryani\'s Institute')
  assert.deepEqual(temple.missingGoodRooms({ corruption: 1, gems: 3, sacrifice: 2, currency: 1, maps: 1 }).map(l => l.id), ['timeless'])
})

test('temple: plan load ignores junk', () => {
  globalThis.localStorage = { s: {}, getItem (k) { return this.s[k] ?? null }, setItem (k, v) { this.s[k] = v } }
  localStorage.setItem(temple.PLAN_KEY, JSON.stringify({ gems: 3, corruption: 7, nope: 2, maps: '2' }))
  assert.deepEqual(temple.loadPlan(), { gems: 3 })
})

test('temple: itemised temple value matches only temples you can make', () => {
  const L = (name, variant, chaos) => ({ category: 'temples', name, variant, chaos, url: name + variant })
  const priced = temple.priceTemples([
    L('Chronicle of Atzoatl', 'Locus of Corruption, Doryani\'s Institute', 900),
    L('Chronicle of Atzoatl', 'Doryani\'s Institute', 300),
    L('Chronicle of Atzoatl', undefined, 20),
    { category: 'currency', name: 'Doryani\'s Institute', chaos: 5000, url: 'x' }
  ], { gems: 3, corruption: 2 })
  assert.equal(priced.length, 3)
  assert.deepEqual(priced.map(p => p.matches), [false, true, false])
  assert.equal(temple.templeValue(priced).chaos, 300)
  assert.equal(temple.templeValue(temple.priceTemples([], {})), null)
})
