// Deathloom fork (Q17): Build progress panel helpers (tree step, gem ticks, gear ticks).
import test from 'node:test'
import assert from 'node:assert/strict'
const bp = await import('./.build/build-progress.mjs')

const node = (id, name, type = 'Normal') => ({ id, name, type })
const plan = {
  level: 20, questPoints: 2, available: 21, phase: 2, kept: 3, keptIds: [1, 2, 3], taken: 2,
  phases: [{ title: 'Level 12', level: 12 }, { title: 'Level 30', level: 30 }, { title: 'Final' }],
  order: [node(10, 'A'), node(11, 'B', 'Notable'), node(12, 'C'), node(13, 'D'), node(14, 'E')],
  refund: [], ascendancy: [], gems: []
}

test('build progress: tree step uses the level guess without log data', () => {
  const t = bp.treeProgress(plan, null)
  assert.equal(t.step, 2); assert.equal(t.steps, 3); assert.equal(t.title, 'Level 30')
  assert.equal(t.taken, 5, 'kept passives count as taken')
  assert.equal(t.total, 8)
  assert.deepEqual(t.next.map(n => n.name), ['C', 'D', 'E'])
})

test('build progress: tree step follows the taken set (holes stay next)', () => {
  const t = bp.treeProgress(plan, new Set([0, 2]), 2)
  assert.equal(t.taken, 5)
  assert.deepEqual(t.next.map(n => n.name), ['B', 'D'])
})

const gem = (name, reqLevel, extra = {}) => ({ name, reqLevel, ...extra })
test('build progress: gems are one per name, missing = usable and not ticked', () => {
  const g = bp.gemProgress([gem('Frostbolt', 4), gem('Frostbolt', 1), gem('Arc', 12), gem('Cyclone', 28)], ['Arc'], 12)
  assert.equal(g.total, 3)
  assert.equal(g.have, 1)
  assert.deepEqual(g.gems.map(x => x.name), ['Frostbolt', 'Arc', 'Cyclone'])
  assert.deepEqual(g.missing.map(x => x.name), ['Frostbolt'], 'Cyclone is above level 12')
})

const item = (slot, name, extra = {}) => ({ slot, label: slot, group: 'gear', name, baseName: name + ' base', rarity: 'Rare', type: 'x', mods: [], searchText: name, text: '', ...extra })
test('build progress: gear ticks count only for the same item, swap left out', () => {
  const items = [item('Helmet', 'Doom Crown'), item('Body Armour', 'Tabula', { rarity: 'Unique' }), item('Weapon 1 Swap', 'Stick', { group: 'swap' })]
  let owned = bp.toggleGearOwned({}, 'B|Set', items[0])
  owned = bp.toggleGearOwned(owned, 'B|Set', items[1])
  const g = bp.gearProgress(items, owned['B|Set'])
  assert.equal(g.total, 2); assert.equal(g.have, 2)
  // the build's helmet changes: the old tick no longer counts
  const g2 = bp.gearProgress([item('Helmet', 'Other Crown'), items[1]], owned['B|Set'])
  assert.equal(g2.have, 1)
  // untick
  owned = bp.toggleGearOwned(owned, 'B|Set', items[1])
  assert.equal(bp.gearProgress(items, owned['B|Set']).have, 1)
  assert.equal(bp.gearOwnedKey('B', 'Set'), 'B|Set')
  assert.equal(bp.gearOwnedKey(undefined, undefined), '|')
})

test('build progress: gem tick toggles per character', () => {
  let t = bp.toggleGemTick({}, 'Bob', 'Arc')
  t = bp.toggleGemTick(t, 'Ann', 'Arc')
  t = bp.toggleGemTick(t, 'Bob', 'Arc')
  assert.deepEqual(t, { Bob: [], Ann: ['Arc'] })
})

test('build progress: stored ticks survive bad data', () => {
  assert.deepEqual(bp.parseGemTicks('not json'), {})
  assert.deepEqual(bp.parseGearOwned('[1,2]'), {})
  assert.deepEqual(bp.parseGearOwned(null), {})
  assert.deepEqual(bp.parseGemTicks('{"Bob":["Arc"]}'), { Bob: ['Arc'] })
})

test('build progress: overall percent averages the parts shown', () => {
  assert.equal(bp.overallPercent([null, { have: 0, total: 0 }]), null)
  assert.equal(bp.overallPercent([{ have: 1, total: 2 }, { have: 2, total: 2 }, null]), 75)
  assert.equal(bp.overallPercent([{ have: 9, total: 8 }]), 100, 'capped per part')
})
