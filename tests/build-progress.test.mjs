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

test('build progress: tree step is only the arrows step, not the level guess', () => {
  const t = bp.treeProgress(plan, 2)
  assert.equal(t.step, 2); assert.equal(t.steps, 3); assert.equal(t.title, 'Level 30')
  assert.equal(t.taken, 5, 'kept passives count as taken')
  assert.equal(t.total, 8)
  assert.deepEqual(t.next.map(n => n.name), ['C', 'D', 'E'])
  // plan.taken (level guess) is 2, but nothing stepped yet means nothing taken
  const z = bp.treeProgress(plan, 0, 2)
  assert.equal(z.taken, 3)
  assert.deepEqual(z.next.map(n => n.name), ['A', 'B'])
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

// ---- Q18: next upgrades ----
const cmp = (header, stats) => ({ header, summary: Object.entries(stats).map(([stat, pct]) => ({ stat, pct })) })
test('upgrades (Q18): impact takes the best slot, minion DPS first, eHP at half weight', () => {
  const s = bp.impactScore([cmp('Ring 1', { FullDPS: 4, TotalEHP: 2 }), cmp('Ring 2', { FullDPS: 10, TotalEHP: -4 })])
  assert.equal(s.slot, 'Ring 2'); assert.equal(s.score, 8)
  const m = bp.impactScore([cmp('Helmet', { MinionDPS: 20, FullDPS: 1 })])
  assert.equal(m.dpsPct, 20)
  const c = bp.impactScore([cmp('Helmet', { CombinedDPS: 3 })])
  assert.equal(c.dpsPct, 3)
  assert.equal(bp.impactScore([]), null)
  assert.equal(bp.impactScore(undefined), null)
  assert.equal(bp.impactScore([{ header: 'x', summary: [{ stat: 'FullDPS' }] }]).score, 0, 'no pct (old value 0) counts as 0')
})

test('upgrades (Q18): ranked by gain per chaos, losers and unpriced left out, top 3', () => {
  const u = (name, chaos, score) => ({ item: name, chaos, impact: { dpsPct: score, ehpPct: 0, score, slot: '' } })
  const r = bp.rankUpgrades([u('big', 1000, 50), u('cheap', 5, 2), u('mid', 100, 10), u('worse', 1, -3), u('free', 0, 9), u('ok', 50, 4)])
  assert.deepEqual(r.map(x => x.item), ['cheap', 'mid', 'ok'])
  assert.equal(bp.perHundredChaos(u('a', 0.5, 1)), 100, 'under 1c counts as 1c')
})

test('upgrades (Q18): cheapest unique price, candidates are unticked uniques', () => {
  const l = [{ ns: 'UNIQUE', name: 'Tabula Rasa', chaos: 40 }, { ns: 'UNIQUE', name: 'Tabula Rasa', chaos: 12 }, { ns: 'ITEM', name: 'Tabula Rasa', chaos: 1 }, { ns: 'UNIQUE', name: 'X', chaos: 0 }]
  assert.equal(bp.cheapestUnique(l, 'Tabula Rasa'), 12)
  assert.equal(bp.cheapestUnique(l, 'X'), null)
  const rows = [
    { item: item('Body Armour', 'Tabula', { rarity: 'Unique' }), owned: false },
    { item: item('Helmet', 'Crown', { rarity: 'Unique' }), owned: true },
    { item: item('Gloves', 'Grip'), owned: false }
  ]
  const c = bp.upgradeCandidates(rows)
  assert.deepEqual(c.uniques.map(i => i.slot), ['Body Armour'])
  assert.deepEqual(c.rares.map(i => i.slot), ['Gloves'])
  const many = Array.from({ length: 12 }, (_, i) => ({ item: item('J' + i, 'J', { rarity: 'Unique' }), owned: false }))
  assert.equal(bp.upgradeCandidates(many).uniques.length, bp.MAX_UPGRADE_CHECKS)
})
