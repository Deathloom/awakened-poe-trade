// Deathloom fork (Q1): regression guards for data we added on top of upstream.
// An upstream data refresh once replaced our additions and 25 exchange items
// silently vanished from price check. These tests fail loudly if that happens
// again (or if the atlas tree / Threads / vendor recipe data goes missing),
// plus a few pure panel helpers that had no tests yet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const store = {}
globalThis.localStorage = {
  get length () { return Object.keys(store).length },
  key: i => Object.keys(store)[i] ?? null,
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear: () => { for (const k of Object.keys(store)) delete store[k] }
}

// ---- price check / exchange data ---------------------------------------------

const ITEMS = readFileSync(join(root, 'renderer/public/data/en/items.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l))

// name -> trade tag (bulk exchange id) as added in #262. Keep in sync if GGG renames one.
const OUR_EXCHANGE_ITEMS = {
  "Originator's Exalted Orb": 'originators-exalted-orb',
  'Primordial Exalted Orb': 'primordial-exalted-orb',
  'Frayed Thread': 'frayed-thread',
  "Engineer's Orb": 'engineers',
  "Infused Engineer's Orb": 'infused-engineers-orb',
  "Cartographer's Chisel": 'chisel',
  'Orb of Horizons': 'orb-of-horizons',
  "Harbinger's Orb": 'harbingers-orb',
  "Dead Man's Sulphur": 'dead-mans-sulphur',
  'Transmutation Shard': 'transmutation-shard',
  'Alteration Shard': 'alteration-shard',
  'Alchemy Shard': 'alchemy-shard',
  'Blessing of Xoph': 'blessing-xoph',
  'Blessing of Tul': 'blessing-tul',
  'Blessing of Esh': 'blessing-esh',
  'Blessing of Uul-Netol': 'blessing-uul-netol',
  'Blessing of Chayula': 'blessing-chayula',
  'Key to the Crucible': 'shaper-set',
  'Key to Decay': 'key-to-decay',
  'Maddening Object': 'maddening-object',
  'Crest of the Elderslayers': 'crest-of-the-elderslayers',
  'Omen of Acceleration': 'omen-of-acceleration',
  'Omen of Revenge': 'omen-of-revenge',
  'Omen of Bequeathal': 'omen-of-bequeathal',
  'Omen of Resurgence': 'omen-of-resurgence'
}

test('price check data: our exchange items are there, with their trade tag', () => {
  const byName = new Map(ITEMS.filter(o => o.namespace === 'ITEM').map(o => [o.name, o]))
  const missing = Object.keys(OUR_EXCHANGE_ITEMS).filter(n => !byName.has(n))
  assert.deepEqual(missing, [], 'exchange items missing from renderer/public/data/en/items.ndjson')
  for (const [name, tag] of Object.entries(OUR_EXCHANGE_ITEMS)) {
    const it = byName.get(name)
    assert.equal(it.tradeTag, tag, `${name}: trade tag`)
    assert.equal(it.exchangeable, true, `${name}: exchangeable`)
    assert.equal(it.refName, name, `${name}: refName`)
  }
})

test('price check data: sane size, every line parses, trade tags unique', () => {
  assert.ok(ITEMS.length > 4000, `only ${ITEMS.length} items`)
  assert.ok(ITEMS.filter(o => o.exchangeable).length > 900, 'too few exchange items')
  for (const core of ['Chaos Orb', 'Divine Orb', 'Exalted Orb', 'Mirror of Kalandra']) {
    assert.ok(ITEMS.some(o => o.namespace === 'ITEM' && o.name === core && o.tradeTag), core)
  }
  const seen = new Map()
  for (const o of ITEMS) {
    if (!o.tradeTag) continue
    assert.ok(!seen.has(o.tradeTag), `trade tag ${o.tradeTag} on both ${seen.get(o.tradeTag)} and ${o.name}`)
    seen.set(o.tradeTag, o.name)
  }
})

test('Market → Crafting lists the 3.30.0d Exalted orbs, all priced from price check data', async () => {
  const mt = await import('./.build/market-tools.mjs')
  for (const n of ["Originator's Exalted Orb", 'Primordial Exalted Orb']) {
    assert.ok(mt.CRAFT_CURRENCY.includes(n), n)
  }
  assert.equal(new Set(mt.CRAFT_CURRENCY).size, mt.CRAFT_CURRENCY.length, 'duplicate in CRAFT_CURRENCY')
  const names = new Set(ITEMS.filter(o => o.namespace === 'ITEM').map(o => o.name))
  assert.deepEqual(mt.CRAFT_CURRENCY.filter(n => !names.has(n)), [], 'crafting currency not in price check data')
})

// ---- atlas tree --------------------------------------------------------------

test('atlas tree: 3.30.0c layout with its new notables', () => {
  const t = readJson('renderer/src/web/atlas/atlas-tree.json')
  assert.match(t.version, /^3\.30\./)
  assert.ok(t.nodes.length >= 1000, `only ${t.nodes.length} atlas nodes`)
  const names = new Set(t.nodes.map(n => n[6]))
  for (const n of ['Celestial Presence', 'Runic Distortion']) assert.ok(names.has(n), `${n} missing from atlas tree`)
  assert.equal(t.nodes.filter(n => n[3] === 5).length, 1, 'one start node')
  assert.ok(Object.keys(t.variants).length > 0, 'multiple-choice notables missing')
})

test('atlas tree: link parsing, code round trip, points and chosen stats', async () => {
  const at = await import('./.build/atlas-tree-test.mjs')
  assert.equal(at.codeFromInput(''), null)
  assert.equal(at.codeFromInput('  AAAABgAAAA==  '), 'AAAABgAAAA')
  assert.equal(at.codeFromInput('https://www.pathofexile.com/fullscreen-atlas-skill-tree/AAAABgAAAA?x=1'), 'AAAABgAAAA')
  assert.equal(at.codeFromInput('https://example.com/short'), null)
  assert.equal(at.codeFromInput('not a code!'), null)
  assert.throws(() => at.codeFromInput('https://poeplanner.com/atlas/AAAABgAAAA'), /poeplanner/)
  assert.equal(at.atlasUrl('abc'), 'https://www.pathofexile.com/fullscreen-atlas-skill-tree/abc')

  const start = [...at.ATLAS_START][0]
  const [choiceNode, effects] = Object.entries(at.ATLAS.variants)[0]
  const plain = at.ATLAS.nodes.find(n => n[3] !== 5 && n[3] !== 3 && !at.ATLAS.variants[String(n[0])])
  const spec = { nodes: [start, plain[0], Number(choiceNode)], choices: { [choiceNode]: effects[1][0] } }
  const back = at.decodeAtlas(at.encodeAtlas(spec))
  assert.deepEqual(back.nodes.sort(), [plain[0], Number(choiceNode)].sort()) // start node isn't written
  assert.deepEqual(back.choices, spec.choices)
  assert.equal(back.unknown, 0)
  assert.equal(at.pointsOf(spec.nodes), 2) // start is free
  const node = at.ATLAS_BY_ID.get(Number(choiceNode))
  assert.deepEqual(at.statsOf(node, spec.choices), effects[1][1])
  assert.ok(at.statsOf(node, {})[0].startsWith('Option 1: '))
  assert.deepEqual(at.statsOf(plain, {}), plain[8])
})

// ---- Threads / cheat sheets / vendor recipes ---------------------------------

test('cheat sheets: Threads of Creation and the 3.30.0c Thread bonuses are there', async () => {
  const { SHEETS } = await import('./.build/sheets.mjs')
  const lines = SHEETS.flatMap(s => s.sections.flatMap(x => x.lines)).join('\n')
  const threads = SHEETS.find(s => s.id === 'leagues')?.sections.find(x => /Threads of Creation/.test(x.title))
  assert.ok(threads, 'Threads of Creation section missing from Map mechanics')
  for (const t of ['Abyss', 'Bestiary', 'Betrayal', 'Blight', 'Breach', 'Expedition', 'Incursion', 'Legion', 'Ritual', 'Ultimatum']) {
    assert.ok(threads.lines.some(l => l.includes(t)), `Thread ${t}`)
  }
  assert.match(lines, /Frayed Thread/)
  assert.match(lines, /Bonus stat at 3 \/ 6 \/ 8 Threads/)
  assert.match(lines, /Originator's Exalted Orb/)
})

test('vendor recipes: list present and well-formed', async () => {
  const { VENDOR_RECIPES } = await import('./.build/vendor-recipes.mjs')
  assert.ok(VENDOR_RECIPES.length >= 20, `only ${VENDOR_RECIPES.length} vendor recipes`)
  assert.equal(new Set(VENDOR_RECIPES.map(r => r.name)).size, VENDOR_RECIPES.length, 'duplicate recipe name')
  for (const r of VENDOR_RECIPES) {
    assert.ok(r.name && r.give && r.get, r.name)
    assert.ok(Number.isInteger(r.fromAct) && r.fromAct >= 1 && r.fromAct <= 10, `${r.name}: fromAct`)
    assert.ok(r.tags.length > 0, `${r.name}: tags`)
  }
  for (const n of ['Movement speed boots', 'Chromatic Orb']) assert.ok(VENDOR_RECIPES.some(r => r.name === n), n)
  assert.ok(VENDOR_RECIPES.some(r => r.challenge), 'league challenge markers gone')
})

// ---- pure panel logic --------------------------------------------------------

test('league checklist: ticks per league, old league-start ticks carried over once', async () => {
  const pg = await import('./.build/cheat-progress.mjs')
  localStorage.clear()
  const ids = pg.PROGRESS.flatMap(g => g.items.map(i => i.id))
  assert.equal(new Set(ids).size, ids.length, 'duplicate checklist id')
  assert.ok(ids.includes('regions'))

  assert.deepEqual([...pg.loadProgress('A')], [])
  localStorage.setItem('deathloom.league-start.v1', JSON.stringify({ A: ['notes'], B: ['pick'] }))
  assert.deepEqual([...pg.loadProgress('A')], ['ls-notes'])
  pg.saveProgress('A', new Set(['regions'])) // unticked ls-notes: must not come back
  assert.deepEqual([...pg.loadProgress('A')], ['regions'])
  assert.deepEqual([...pg.loadProgress('B')], ['ls-pick']) // other league's old ticks kept
  assert.deepEqual([...pg.loadProgress('C')], [])
  localStorage.setItem('deathloom.endgame-progress.v1', 'not json')
  assert.deepEqual([...pg.loadProgress('A')], []) // broken storage: empty, no throw
  localStorage.clear()
})

test('market: saved crafting and sell lists ignore broken rows', async () => {
  const mt = await import('./.build/market-tools.mjs')
  localStorage.clear()
  assert.deepEqual(mt.loadCraftRows(), [])
  localStorage.setItem(mt.CRAFT_COST_KEY, '{oops')
  assert.deepEqual(mt.loadCraftRows(), [])
  localStorage.setItem(mt.CRAFT_COST_KEY, JSON.stringify([{ name: 'Chaos Orb', count: 2 }, null, { name: 5 }, 'x']))
  assert.deepEqual(mt.loadCraftRows(), [{ name: 'Chaos Orb', count: 2 }])
  mt.saveCraftRows(Array.from({ length: 50 }, (_, i) => ({ name: `R${i}`, count: i })))
  assert.equal(mt.loadCraftRows().length, 40)

  localStorage.setItem(mt.SELL_KEY, JSON.stringify([{ ns: 'ITEM', name: 'Divine Orb', label: 'Divine Orb', qty: 1 }, { name: 'no ns' }, 7]))
  assert.deepEqual(mt.loadSellList().map(e => e.name), ['Divine Orb'])
  localStorage.setItem(mt.SELL_KEY, JSON.stringify({ not: 'a list' }))
  assert.deepEqual(mt.loadSellList(), [])
  localStorage.clear()
})

// ---- league challenges (Cheat sheets → Challenges) --------------------------

test('challenge list: 40 Covens challenges, unique, sourced, links go to real tabs', async () => {
  const ch = await import('./.build/cheat-challenges.mjs')
  const { CHEAT_TAB_IDS } = await import('./.build/sheets.mjs')
  const list = ch.CHALLENGES
  assert.equal(ch.CHALLENGE_TOTAL, 40)
  assert.equal(list.length, 40, 'challenges missing: the panel says so, but fix the list')
  assert.equal(ch.challengesMissing(), 0)
  assert.equal(new Set(list.map(c => c.name)).size, list.length, 'duplicate challenge name')
  assert.equal(new Set(list.map(c => c.id)).size, list.length, 'duplicate challenge id')
  for (const c of list) {
    assert.match(c.id, /^[a-z0-9-]+$/, c.id)
    assert.ok(c.name && c.req, c.id)
    assert.ok(c.sources.length > 0 && c.sources.every(s => ch.CHALLENGE_SOURCES[s]?.label), `${c.id}: source`)
    assert.ok(c.sources.some(s => ch.CHALLENGE_SOURCES[s].url?.startsWith('https://')), `${c.id}: a linked source`)
    if (c.tab) assert.ok(CHEAT_TAB_IDS.includes(c.tab), `${c.id}: tab ${c.tab}`)
    if (c.steps) {
      assert.ok(c.steps.length > 0 && c.steps.every(s => typeof s === 'string' && s), `${c.id}: steps`)
      assert.equal(new Set(c.steps).size, c.steps.length, `${c.id}: duplicate step`)
    }
    if (c.need != null) {
      assert.ok(c.steps && Number.isInteger(c.need) && c.need >= 1 && c.need <= c.steps.length, `${c.id}: need`)
    }
  }
  // never link a real-money-trading shop (GGG forbids RMT): AOEAH is named only
  for (const s of Object.values(ch.CHALLENGE_SOURCES)) assert.ok(!/aoeah|mmojugg|u4gm|mulefactory|igvault|playerauctions/i.test(s.url ?? ''), s.label)
  assert.equal(ch.CHALLENGE_SOURCES.aoeah.url, undefined)
  assert.ok(CHEAT_TAB_IDS.includes('challenges'))
  assert.equal(new Set(CHEAT_TAB_IDS).size, CHEAT_TAB_IDS.length, 'duplicate cheat sheet tab id')
  // anchors both sources agree on
  assert.equal(list[0].name, 'Beginner\'s Basics')
  assert.equal(list[19].name, 'Peddler\'s Produce II')
  assert.equal(list[39].name, 'Grand Goal Grind')
  // Peddler's Produce steps come from the vendor recipe list (not a second copy)
  const { VENDOR_RECIPES } = await import('./.build/vendor-recipes.mjs')
  for (const n of ['Peddler\'s Produce I', 'Peddler\'s Produce II']) {
    const c = list.find(x => x.name === n)
    assert.equal(c.tab, 'recipes')
    assert.equal(c.steps.length, VENDOR_RECIPES.filter(r => r.challenge?.name === n).length, n)
    assert.ok(c.steps.length >= 3, n)
  }
  assert.ok(VENDOR_RECIPES.filter(r => r.challenge).every(r => list.some(c => c.name === r.challenge.name)), 'recipe challenge name not in the list')
})

// ---- PoE2 data (A1) ----------------------------------------------------------

test('PoE2 data: items, stats and client strings are there and kept apart from PoE1', () => {
  const read = (p) => readFileSync(join(root, 'renderer/public/data/poe2', p), 'utf8')
  const items = read('en/items.ndjson').split('\n').filter(Boolean).map(l => JSON.parse(l))
  const stats = read('en/stats.ndjson').split('\n').filter(Boolean).map(l => JSON.parse(l))
  assert.ok(items.length > 3000, `only ${items.length} PoE2 items`)
  assert.ok(stats.length > 2000, `only ${stats.length} PoE2 stats`)
  const names = new Set(items.map(i => i.refName))
  for (const n of ['Exalted Orb', 'Orb of Annulment', 'Greater Rune of Leadership']) {
    assert.ok(names.has(n), `${n} missing from PoE2 items`)
  }
  // a PoE2-only stat: if this turns up in the PoE1 file the data got mixed up
  assert.ok(stats.some(s => s.ref === '# Charm Slot'))
  assert.ok(!readFileSync(join(root, 'renderer/public/data/en/stats.ndjson'), 'utf8').includes('"# Charm Slot"'))
  assert.match(read('en/client_strings.js'), /export default/)
})
