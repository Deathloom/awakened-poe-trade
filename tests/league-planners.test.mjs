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
