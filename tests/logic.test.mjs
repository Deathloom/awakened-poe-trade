import test from 'node:test'
import assert from 'node:assert/strict'

const store = {}
globalThis.localStorage = {
  get length () { return Object.keys(store).length },
  key: i => Object.keys(store)[i] ?? null,
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] }
}

const guard = await import('./.build/request-guard.mjs')
const session = await import('./.build/play-session.mjs')
const money = await import('./.build/money.mjs')
const tools = await import('./.build/settings-tools.mjs')
const search = await import('./.build/search-strings.mjs')
const sheets = await import('./.build/sheets.mjs')
const buildXml = await import('./.build/build-xml.mjs')
const compare = await import('./.build/build-compare.mjs')
const game = await import('./.build/game.mjs')

test('request guard: loopback always, other devices only with the key', () => {
  const K = 'k'.repeat(32)
  const opts = { listenHost: '0.0.0.0', remoteKey: K }
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284' }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284' }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: K }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: 'x'.repeat(32) }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: K }, {}), false)
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', secFetchSite: 'cross-site' }, {}), false)
  assert.equal(guard.requestKey('/?desktop&key=' + K, undefined), K)
  assert.equal(guard.requestKey('/', 'a=1; orbhoarder_key=' + K), K)
})

test('map profit and last session', () => {
  const s = session.emptySession(0)
  s.maps = [
    { code: 'MapA', name: 'A', level: 80, seed: '1', start: 0, ms: 30 * 60000, deaths: 0, mechanics: [] },
    { code: 'MapB', name: 'B', level: 80, seed: '2', start: 0, ms: 30 * 60000, deaths: 1, mechanics: [] }
  ]
  s.lastAt = 3600000
  session.savePlaySession(s)
  session.addMapLoot('1', 'MapA', 100)
  session.addMapLoot('1', 'MapA', 50)
  session.addMapLoot('2', 'MapB', 200)
  const n = session.loadPlaySession()
  assert.deepEqual(n.maps.map(m => m.loot), [150, 200])
  const p = session.mapProfit(n, 10, 3600000)
  assert.equal(p.loot, 350)
  assert.equal(p.perHour, 330)
  session.keepLastSession(n)
  assert.equal(session.loadLastSession().maps, 2)
})

test('gem levelling profit', () => {
  const g = (name, variant, chaos) => ({ name, variant, chaos, category: 'skill-gems', ns: 'GEM', url: 'u' })
  const list = money.gemProfits([g('Fireball', '1', 2), g('Fireball', '20', 30), g('Fireball', '20/20c', 90), g('Empower Support', '1', 5), g('Empower Support', '3', 400)], false, 1)
  assert.deepEqual(list.map(x => [x.name, x.profit]), [['Empower Support', 395], ['Fireball', 28]])
  assert.equal(money.counterTotal({ chaos: 10, counts: { 'Divine Orb': 2, Unknown: 1 }, extra: [] }, n => n === 'Divine Orb' ? 200 : null).chaos, 410)
})

test('hotkey clashes and backup', () => {
  const cfg = { configVersion: 18, overlayKey: 'Shift + Space', pob: { gearPanelKey: 'Ctrl + D', panelKeys: { tree: 'Ctrl + D' }, token: 'secret' }, commands: [], widgets: [] }
  assert.equal(tools.hotkeyClashes(cfg).length, 1)
  store['deathloom.test'] = '1'
  const b = tools.makeBackup(cfg)
  assert.ok(!b.includes('secret'))
  const into = { configVersion: 18 }
  assert.equal(tools.readBackup(b, into).ok, true)
  assert.equal(into.overlayKey, 'Shift + Space')
  assert.equal(tools.readBackup(b, { configVersion: 17 }).ok, false)
})

test('search strings fit the game\'s 50-character limit', () => {
  const list = search.buildSearchStrings([{ enabled: true, gems: [{ name: 'Fireball', enabled: true }, { name: 'Spell Echo Support', enabled: true, support: true }] }], ['Monsters reflect #% of Elemental Damage'])
  assert.ok(list.length > 5)
  for (const s of list) assert.ok(s.text.length <= search.MAX_SEARCH, `${s.key}: ${s.text}`)
})

test('cheat sheet focus switch', () => {
  const cov = sheets.SHEETS.find(s => s.id === 'covens')
  assert.ok(cov && cov.focuses.length === 3)
  for (const f of cov.focuses) {
    const secs = sheets.sectionsFor(cov, f.id)
    assert.ok(secs.some(s => s.focus === f.id), f.id + ' has its own section')
    assert.ok(secs.every(s => !s.focus || s.focus === f.id))
  }
  // unknown focus falls back to the first; sheets without focuses show everything
  assert.deepEqual(sheets.sectionsFor(cov, 'nope'), sheets.sectionsFor(cov, cov.focuses[0].id))
  const plain = sheets.SHEETS.find(s => !s.focuses)
  assert.equal(sheets.sectionsFor(plain, 'x').length, plain.sections.length)
  // ids are unique
  assert.equal(new Set(sheets.SHEETS.map(s => s.id)).size, sheets.SHEETS.length)
})

const BUILD = (o) => `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="${o.level}" className="Witch" ascendClassName="Necromancer" mainSocketGroup="1">
    <PlayerStat stat="Life" value="${o.life}"/>
    <PlayerStat stat="CombinedDPS" value="${o.dps}"/>
    <PlayerStat stat="FireResist" value="75"/>
  </Build>
  <Skills activeSkillSet="2">
    <SkillSet id="1"><Skill enabled="true"><Gem nameSpec="Wrong Set" level="1" enabled="true"/></Skill></SkillSet>
    <SkillSet id="2">
      <Skill enabled="true" slot="Body Armour" label=""><Gem nameSpec="${o.skill}" level="${o.gemLevel}" quality="20" enabled="true"/><Gem nameSpec="Minion Damage Support" level="20" enabled="true"/></Skill>
      <Skill enabled="false"><Gem nameSpec="Disabled Gem" level="20" enabled="true"/></Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1"><Spec treeVersion="3_30" nodes="${o.nodes}" masteryEffects="{100,${o.mastery}}"><URL>x</URL></Spec></Tree>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
Doom Cowl
Hubris Circlet
Unique ID: abc
Item Level: 84
Quality: 20
Implicits: 0
+${o.helmLife} to maximum Life
{crafted}{range:0.5}+30% to Fire Resistance
Corrupted
</Item>
    <Item id="2">
Rarity: UNIQUE
Tabula Rasa
Simple Robe
Sockets: W-W-W-W-W-W
Has no Sockets &amp; stuff
</Item>
    <ItemSet id="1"><Slot name="Helmet" itemId="1"/><Slot name="Body Armour" itemId="${o.body}"/><Slot name="Gloves" itemId="0"/></ItemSet>
  </Items>
</PathOfBuilding>`

test('build files: read and compare two builds', () => {
  const a = buildXml.parseBuildXml(BUILD({ level: 90, life: 4000, dps: 1e6, skill: 'Raise Zombie', gemLevel: 20, nodes: '1,2,3,100', mastery: 5, helmLife: 80, body: 2 }))
  const b = buildXml.parseBuildXml(BUILD({ level: 92, life: 4500, dps: 9e5, skill: 'Summon Skeletons', gemLevel: 21, nodes: '2,3,4,5,100', mastery: 6, helmLife: 90, body: 3 }))
  assert.equal(a.ascendancy, 'Necromancer')
  assert.equal(a.level, 90)
  assert.equal(a.mainSkill, 'Raise Zombie')
  assert.equal(a.stats.Life, 4000)
  assert.equal(a.groups.length, 2)
  assert.ok(!a.groups.flatMap(g => g.gems).some(g => g.name === 'Wrong Set'))
  assert.deepEqual(a.items.map(i => i.slot), ['Helmet', 'Body Armour'])
  assert.deepEqual(a.items[0].mods, ['+80 to maximum Life', '+30% to Fire Resistance'])
  assert.equal(a.items[1].name, 'Tabula Rasa')
  assert.deepEqual(a.items[1].mods, ['Has no Sockets & stuff'])
  assert.equal(b.items.length, 1) // item 3 doesn't exist
  assert.deepEqual(a.tree.masteries, { 100: '5' })

  const c = compare.compareBuilds(a, b)
  const life = c.stats.find(r => r.stat === 'Life')
  assert.equal(life.diff, 500); assert.equal(life.better, 'b')
  assert.equal(c.stats.find(r => r.stat === 'CombinedDPS').better, 'a')
  assert.equal(c.stats.find(r => r.stat === 'FireResist').better, undefined)
  const helm = c.gear.find(g => g.slot === 'Helmet')
  assert.deepEqual(helm.aLower, [{ a: '+80 to maximum Life', b: '+90 to maximum Life' }]); assert.deepEqual(helm.onlyB, [])
  assert.equal(c.gear.find(g => g.slot === 'Body Armour').b, undefined)
  assert.deepEqual(c.gems.map(g => `${g.change}:${g.name}`), ['removed:Raise Zombie', 'added:Summon Skeletons'])
  assert.deepEqual(c.tree.onlyA, [1]); assert.deepEqual(c.tree.onlyB, [4, 5]); assert.equal(c.tree.same, 3)
  assert.deepEqual(c.tree.masteriesChanged, [100])
  assert.throws(() => buildXml.parseBuildXml('<html></html>'))
  assert.equal(compare.fmtStat(1234567), '1.23M')
})

test('game switch: window title, exe match, default league', () => {
  assert.equal(game.asGame('poe2'), 'poe2'); assert.equal(game.asGame(undefined), 'poe1'); assert.equal(game.asGame('x'), 'poe1')
  assert.equal(game.windowTitleOnSwitch('poe2', 'Path of Exile'), 'Path of Exile 2')
  assert.equal(game.windowTitleOnSwitch('poe1', 'Path of Exile 2'), 'Path of Exile')
  assert.equal(game.windowTitleOnSwitch('poe2', ''), 'Path of Exile 2')
  assert.equal(game.windowTitleOnSwitch('poe2', 'My PoE'), 'My PoE')
  assert.equal(game.exeMatchesGame('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\PathOfExileSteam.exe', 'poe2'), true)
  assert.equal(game.exeMatchesGame('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\PathOfExileSteam.exe', 'poe1'), false)
  assert.equal(game.exeMatchesGame('D:\\Games\\Path of Exile\\PathOfExile_x64.exe', 'poe1'), true)
  assert.equal(game.exeMatchesGame('D:\\Games\\Path of Exile 2 backup\\x.exe', 'poe1'), true)
  assert.equal(game.pickDefaultLeague(['Standard', 'Hardcore', 'Rise of the Abyssal', 'HC Rise of the Abyssal']), 'Rise of the Abyssal')
  assert.equal(game.pickDefaultLeague(['HC Fate of the Vaal', 'Fate of the Vaal SSF', 'Fate of the Vaal', 'Standard']), 'Fate of the Vaal')
  assert.equal(game.pickDefaultLeague(['Hardcore', 'Standard']), 'Standard')
  assert.equal(game.pickDefaultLeague([]), undefined)
})

const vr = await import('./.build/vendor-regex.mjs')
test('vendor regex: numbers, links, query', () => {
  const re = (n, d) => new RegExp('^(' + vr.atLeast(n, d) + ')$')
  for (const [n, d] of [[0, 2], [5, 3], [10, 2], [15, 2], [25, 2], [99, 2], [40, 3], [100, 3], [149, 3]]) {
    for (let v = 0; v < 10 ** d; v++) assert.equal(re(n, d).test(String(v)), v >= n, `atLeast(${n},${d}) on ${v}`)
  }
  assert.equal(vr.atLeast(15, 2), '1[5-9]|[2-9]\\d')
  assert.equal(vr.linkPattern(3, []), '\\w-\\w-\\w')
  const rgb = vr.linkPattern(3, ['r', 'g', 'b']).split('|')
  assert.equal(rgb.length, 6)
  assert.equal(vr.linkPattern(4, ['r', 'r', 'b', 'x']).split('|').length, 12)
  const q = { ...vr.emptyQuery(), links: 4, moveSpeed: 20, match: 'all' }
  const r = vr.vendorRegex(q)
  assert.equal(r.text, '"\\w-\\w-\\w-\\w" "[2-9]\\d% increased mov"')
  assert.equal(r.tooLong, false)
  const ms = new RegExp(vr.vendorParts({ ...vr.emptyQuery(), moveSpeed: 15 })[0].regex, 'i')
  assert.ok(ms.test('15% increased Movement Speed')); assert.ok(!ms.test('10% increased Movement Speed'))
  const life = new RegExp(vr.vendorParts({ ...vr.emptyQuery(), life: 70 })[0].regex, 'i')
  assert.ok(life.test('+74 to maximum Life')); assert.ok(life.test('+120 to maximum Life')); assert.ok(!life.test('+69 to maximum Life'))
  const res = new RegExp(vr.vendorParts({ ...vr.emptyQuery(), resists: ['fire', 'lightning'], resistMin: 30 })[0].regex, 'i')
  assert.ok(res.test('+34% to Lightning Resistance')); assert.ok(!res.test('+34% to Cold Resistance')); assert.ok(!res.test('+24% to Fire Resistance'))
  assert.equal(vr.vendorRegex({ ...vr.emptyQuery(), custom: 'a.b' }).text, '"a\\.b"')
  assert.equal(vr.vendorRegex(vr.emptyQuery()).text, '')
})

const gk = await import('./.build/game-keys.mjs')
test('game keys: PoE1 defaults that our hotkeys must not take', () => {
  assert.match(gk.poe1KeyUse('Ctrl + T'), /skill 13/)
  assert.match(gk.poe1KeyUse('Ctrl + C'), /copy/)
  for (const k of ['Ctrl + B', 'Ctrl + G', 'Ctrl + H', 'Ctrl + P', 'Ctrl + D', 'Shift + Space', 'F5', 'F9', null, undefined]) {
    assert.equal(gk.poe1KeyUse(k), undefined, String(k))
  }
})

const craft = await import('./.build/craft-sim.mjs')

// small seeded random (mulberry32) so the numbers don't wobble between runs
function seeded (seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

test('crafting: tiers and wanted groups', () => {
  const mods = [
    { id: 'Life1', type: 'Prefix', group: 'Life', level: 1, weight: 1000 },
    { id: 'Life3', type: 'Prefix', group: 'Life', level: 44, weight: 1000 },
    { id: 'Life2', type: 'Prefix', group: 'Life', level: 11, weight: 1000 }
  ]
  assert.deepEqual(craft.tiersOf(mods, 'Life').map(m => m.id), ['Life3', 'Life2', 'Life1'])
  assert.equal(craft.tierNumber(mods, mods[2]), 2)
  assert.deepEqual(craft.wantGroup(mods, 'Life', 2).ids, ['Life3', 'Life2'])
})

test('crafting: Alteration odds match the hand-worked answer', () => {
  // one roll from A/B/C (equal weight), then 50% a second mod on the free side;
  // a lone C gets an Augmentation (A is a prefix): P(A) = 1/3 + 1/3 * 1/2 = 1/2
  const pool = { maxAffixes: 3, mods: [
    { id: 'A', type: 'Prefix', group: 'A', level: 1, weight: 100 },
    { id: 'B', type: 'Prefix', group: 'B', level: 1, weight: 100 },
    { id: 'C', type: 'Suffix', group: 'C', level: 1, weight: 100 }
  ] }
  const res = craft.simulate(pool, [{ group: 'A', ids: ['A'] }], { method: 'alt', trials: 100000, random: seeded(7) })
  assert.ok(Math.abs(res.chance - 1 / 2) < 0.01, String(res.chance))
  assert.equal(res.used['Orb of Alteration'], 100000)
  assert.ok(Math.abs(res.used['Orb of Augmentation'] / 100000 - 1 / 6) < 0.01)
  assert.ok(Math.abs(res.attempts - 2) < 0.05)
})

test('crafting: Chaos Orb always hits when every slot must take the wanted mod', () => {
  const pool = { maxAffixes: 3, mods: [
    { id: 'P1', type: 'Prefix', group: 'P1', level: 1, weight: 10 },
    { id: 'P2', type: 'Prefix', group: 'P2', level: 1, weight: 10 },
    { id: 'P3', type: 'Prefix', group: 'P3', level: 1, weight: 10 },
    { id: 'S1', type: 'Suffix', group: 'S1', level: 1, weight: 10 }
  ] }
  // only 4 mods exist: a 4-mod rare has them all; 5/6-mod rolls stop at 4
  const res = craft.simulate(pool, [{ group: 'S1', ids: ['S1'] }, { group: 'P2', ids: ['P2'] }], { method: 'chaos', trials: 2000, random: seeded(1) })
  assert.equal(res.chance, 1)
  assert.equal(craft.costPerHit(res, () => undefined), 1)
})

test('crafting: impossible asks are explained, essence mod always present', () => {
  const pool = { maxAffixes: 3, mods: [
    { id: 'A', type: 'Prefix', group: 'A', level: 1, weight: 100 },
    { id: 'B', type: 'Prefix', group: 'B', level: 1, weight: 100 },
    { id: 'E', type: 'Suffix', group: 'E', level: 1, weight: 0 },
    { id: 'C', type: 'Suffix', group: 'C', level: 1, weight: 100 }
  ] }
  const two = [{ group: 'A', ids: ['A'] }, { group: 'B', ids: ['B'] }]
  assert.match(craft.simulate(pool, two, { method: 'alt' }).impossible, /one prefix/)
  assert.match(craft.simulate(pool, [], { method: 'chaos' }).impossible, /at least one/)
  assert.match(craft.simulate(pool, [{ group: 'A', ids: ['A'] }, { group: 'A', ids: ['A'] }], { method: 'chaos' }).impossible, /same group/)
  const ess = craft.simulate(pool, [{ group: 'E', ids: ['E'] }], { method: 'essence', essenceModId: 'E', trials: 500, random: seeded(3) })
  assert.equal(ess.chance, 1)
  assert.equal(craft.costPerHit(ess, n => n === 'Deafening Essence of Test' ? 3 : undefined, 'Deafening Essence of Test'), 3)
  assert.match(craft.fmtChance(0.00002), /^1 in 50\D?000$/)
})

const changelog = await import('./.build/changelog.mjs')

test('changelog: one heading per kind in What\'s new', () => {
  const md = '## [Unreleased]\n\n### Changed (#198)\n- a\n\n### Added (#195)\n- b\n\n### Changed (#196)\n- c\n  - c2\n\n## [1.0.89] - 2026-11-15\n### Fixed\n- d\n'
  const v = changelog.parseChangelog(md, '1.0.90-beta.9')
  assert.equal(v.length, 2)
  assert.equal(v[0].body, '### Changed\n- a\n- c\n  - c2\n\n### Added\n- b')
  assert.equal(v[1].body, '### Fixed\n- d')
  assert.equal(changelog.mergeSections('just text'), 'just text')
})

test('campaign guide: per-character step, campaign done, endgame areas', async () => {
  const route = await import('./.build/campaign-route.mjs')
  assert.equal(route.isEndgameArea('MapWorldsStrand'), true)
  assert.equal(route.isEndgameArea('2_10_1'), false)
  assert.equal(route.isEndgameArea('HideoutFelled'), false)
  assert.equal(route.isEndgameArea(undefined), false)
  assert.equal(route.campaignDone(null), false)
  assert.equal(route.campaignDone({ kitava: ['cruel'] }), false)
  assert.equal(route.campaignDone({ kitava: ['cruel', 'merciless'] }), true)
  assert.equal(route.campaignDone({ endgame: true }), true)
  const a10 = route.firstStepOfAct(10)
  assert.ok(a10 > 0 && route.STEPS[a10].act === 10 && route.STEPS[a10 - 1].act === 9)
  assert.equal(route.firstStepOfAct(12), -1)
  route.saveStepForChar('Alpha', 5)
  route.saveStepForChar('Beta', a10)
  route.saveStepForChar('', 3)
  assert.deepEqual(route.loadStepByChar(), { Alpha: 5, Beta: a10 })
  for (let i = 0; i < 25; i++) route.saveStepForChar('C' + i, 1)
  const all = route.loadStepByChar()
  assert.equal(Object.keys(all).length, 20)
  assert.equal(all.C24, 1)
})

test('passive tree: taken passives only get the path they need', async () => {
  const { fillTakenPaths } = await import('./.build/taken-paths.mjs')
  // start 0 - 1 - 2, and a loop 2 - 3 - 4 - 5 - 2 (3 and 5 both next to 4)
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [4, 6]]
  const target = new Set([1, 2, 3, 4, 5, 6])
  // went round via 3: 5 sits between two taken passives but isn't taken
  let got = fillTakenPaths({ links, roots: [0], target, have: [1, 2, 3, 4] })
  assert.deepEqual([...got].sort(), [1, 2, 3, 4])
  // 6 placed but cut off (its same-named count went elsewhere): shortest path back is filled
  got = fillTakenPaths({ links, roots: [0], target, have: [1, 6] })
  assert.ok(got.has(2) && got.has(6) && got.has(4))
  assert.equal(got.has(3) && got.has(5), false)
  // masteries never need a path
  got = fillTakenPaths({ links, roots: [0], target: new Set([1, 9]), have: [1, 9], floating: new Set([9]) })
  assert.deepEqual([...got].sort(), [1, 9])
})

test('craft plan: match PoB gear mods to the pool and plan the steps', async () => {
  const plan = await import('./.build/craft-plan.mjs')
  assert.equal(plan.skeleton('+(80-89) to maximum Life'), plan.skeleton('+85 to maximum Life'))
  const mods = [
    { id: 'L1', type: 'Prefix', group: 'Life', level: 82, weight: 1000, text: ['+(100-109) to maximum Life'] },
    { id: 'L2', type: 'Prefix', group: 'Life', level: 64, weight: 1000, text: ['+(80-89) to maximum Life'] },
    { id: 'F1', type: 'Suffix', group: 'Fire', level: 84, weight: 1000, text: ['+(46-48)% to Fire Resistance'] },
    { id: 'F2', type: 'Suffix', group: 'Fire', level: 60, weight: 1000, text: ['+(36-41)% to Fire Resistance'] },
    { id: 'H1', type: 'Prefix', group: 'Hybrid', level: 30, weight: 500, text: ['+(10-20) to Armour', '+(5-10) to maximum Life'] },
    { id: 'C1', type: 'Suffix', group: 'Cold', level: 1, weight: 1000, text: ['+(6-11)% to Cold Resistance'] }
  ]
  const m = plan.matchItemMods(mods, [
    { text: '+85 to maximum Life', kind: 'explicit' },
    { text: '+47% to Fire Resistance', kind: 'explicit' },
    { text: '+15 to Armour', kind: 'explicit' },
    { text: '+7 to maximum Life', kind: 'explicit' },
    { text: '+30% to Cold Resistance', kind: 'explicit', crafted: true },
    { text: '10% increased Movement Speed', kind: 'explicit' },
    { text: '+20 to Strength', kind: 'implicit' }
  ])
  const by = Object.fromEntries(m.wants.map(w => [w.group, w.tier]))
  assert.deepEqual(by, { Hybrid: 1, Life: 2, Fire: 1 })
  assert.equal(m.ilvl, 84)
  assert.deepEqual(m.crafted, ['+30% to Cold Resistance'])
  assert.deepEqual(m.unmatched, ['10% increased Movement Speed'])
  assert.deepEqual(m.other, ['+20 to Strength'])
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const pool = { mods: mods.map(({ text, ...x }) => x), maxAffixes: 6 }
  const wants = [{ group: 'Fire', ids: ['F1'], type: 'Suffix', label: 'Fire T1' }, { group: 'Life', ids: ['L1', 'L2'], type: 'Prefix', label: 'Life T2+' }]
  const steps = plan.buildPlan({ pool, wants, essences: [], baseName: 'Vaal Regalia', ilvl: 84, crafted: m.crafted, trials: 2000, random })
  assert.deepEqual(steps.map(s => s.kind), ['base', 'roll', 'bench', 'finish'])
  assert.ok(steps[1].result.hits > 0)
})

const pobPin = await import('./.build/pob-pin.mjs')
test('PoB pin: test builds read dev, stable reads master', () => {
  assert.equal(pobPin.pobPinUrl('1.0.90-beta.18'), pobPin.POB_PIN_URL_TESTING)
  assert.match(pobPin.POB_PIN_URL_TESTING, /\/dev\//)
  assert.equal(pobPin.pobPinUrl('1.0.90'), pobPin.POB_PIN_URL)
  assert.match(pobPin.POB_PIN_URL, /\/master\//)
  assert.equal(pobPin.parsePobPin("POB_PIN = '" + 'a'.repeat(40) + "'"), 'a'.repeat(40))
})

test('timeless find: wants replace per notable / per stat, trade query for any conqueror', async () => {
  const tf = await import('./.build/timeless-find.mjs')
  let w = tf.addWant([], { label: 'A', node: 1 })
  w = tf.addWant(w, { label: 'B', node: 1 })
  assert.deepEqual(w, [{ label: 'B', node: 1 }])
  w = tf.addWant(w, { label: 'X', min: 2 })
  w = tf.addWant(w, { label: 'X', min: 3 })
  assert.equal(w.length, 2)
  assert.equal(w[1].min, 3)
  w = tf.removeWant(w, { label: 'B', node: 1 })
  assert.deepEqual(w, [{ label: 'X', min: 3 }])
  let many = []
  for (let i = 0; i < 12; i++) many = tf.addWant(many, { label: `L${i}` })
  assert.equal(many.length, tf.MAX_WANTS)
  assert.equal(tf.wantText({ label: 'X', min: 2 }), 'X (on 2+ notables)')
  assert.equal(tf.wantText({ label: 'Y', node: 5 }, 'Iron Grip'), 'Iron Grip → Y')
  const one = tf.timelessTradeQuery('Lethal Pride', ['Kaom'], 12345)
  assert.equal(one.query.stats[0].type, 'and')
  assert.equal(one.query.stats[0].filters[0].id, 'explicit.pseudo_timeless_jewel_kaom')
  const any = tf.timelessTradeQuery('Lethal Pride', ['Kaom', 'Rakiata', 'Akoya'], 12345)
  assert.equal(any.query.stats[0].type, 'count')
  assert.deepEqual(any.query.stats[0].value, { min: 1 })
  assert.equal(any.query.stats[0].filters.length, 3)
  assert.deepEqual(any.query.stats[0].filters[2].value, { min: 12345, max: 12345 })
})

test('item regex: mods to short stash search parts', async () => {
  const ir = await import('./.build/item-regex.mjs')
  const life = new RegExp(ir.modRegex('+85 to maximum Life'), 'i')
  assert.ok(life.test('+85 to maximum Life')); assert.ok(life.test('+112 to maximum Life'))
  assert.ok(!life.test('+70 to maximum Life'))
  const anyLife = new RegExp(ir.modRegex('+85 to maximum Life', false), 'i')
  assert.ok(anyLife.test('+70 to maximum Life'))
  const res = new RegExp(ir.modRegex('+45% to Fire Resistance'), 'i')
  assert.ok(res.test('+46% to Fire Resistance')); assert.ok(!res.test('+40% to Fire Resistance'))
  assert.ok(!res.test('+46% to Cold Resistance'))
  const adds = new RegExp(ir.modRegex('Adds 12 to 24 Physical Damage to Attacks'), 'i')
  assert.ok(adds.test('Adds 15 to 30 Physical Damage to Attacks')); assert.ok(!adds.test('Adds 5 to 9 Physical Damage to Attacks'))
  const dec = new RegExp(ir.modRegex('1.5% of Physical Attack Damage Leeched as Life'), 'i')
  assert.ok(dec.test('0.8% of Physical Attack Damage Leeched as Life'))
  const deep = new RegExp(ir.modRegex('Socketed Gems are Supported by Level 20 Elemental Damage with Attacks'), 'i')
  assert.ok(deep.test('Socketed Gems are Supported by Level 21 Elemental Damage with Attacks'))
  assert.ok(!deep.test('Socketed Gems are Supported by Level 18 Elemental Damage with Attacks'))
  const plain = ir.modRegex('Cannot be Frozen')
  assert.ok(new RegExp(plain, 'i').test('Cannot be Frozen'))
  for (const t of ['+85 to maximum Life', '+45% to Fire Resistance', 'Adds 12 to 24 Physical Damage to Attacks', '30% increased Movement Speed']) {
    assert.ok(ir.modRegex(t).length <= 45, `${t}: ${ir.modRegex(t)}`)
  }
  const item = { name: 'Doom Stride', baseName: 'Two-Toned Boots', rarity: 'Rare', mods: [{ text: '+85 to maximum Life', kind: 'explicit' }, { text: '30% increased Movement Speed', kind: 'explicit' }] }
  const parts = ir.itemRegexParts(item)
  assert.equal(parts[0].kind, 'base')
  const r = ir.itemRegex(parts.slice(1), 'all')
  assert.equal(r.text.split('" "').length, 2)
  assert.equal(r.tooLong, true)
  // any value on life: fits the game's 50 characters
  const loose = ir.itemRegex(ir.itemRegexParts(item, { mod0: false }).slice(1), 'all')
  assert.equal(loose.tooLong, false, loose.text)
  assert.ok(ir.itemRegex(parts.slice(1), 'any').text.includes('|'))
  assert.equal(ir.itemRegexParts({ ...item, rarity: 'Unique' })[0].kind, 'name')
  // defences and links come from the item text
  const chest = { name: 'Doom Shell', baseName: 'Vaal Regalia', rarity: 'Rare', text: 'Rarity: Rare\nDoom Shell\nVaal Regalia\n--------\nQuality: +20% (augmented)\nEnergy Shield: 412\nWard: 0\n--------\nSockets: B-B-B-B-R G\n--------\nItem Level: 84', mods: [] }
  const cp = ir.itemRegexParts(chest)
  const es = cp.find(p => p.label === 'Energy Shield: 412')
  assert.ok(es)
  const esRe = new RegExp(es.regex, 'i')
  assert.ok(esRe.test('Energy Shield: 412')); assert.ok(esRe.test('Energy Shield: 1050')); assert.ok(!esRe.test('Energy Shield: 390'))
  assert.ok(new RegExp(ir.itemRegexParts(chest, { 'def-shield:': false }).find(p => p.kind === 'defence').regex, 'i').test('Energy Shield: 100'))
  const link = cp.find(p => p.kind === 'links')
  assert.equal(link.label, '5-link (any colours)')
  assert.ok(new RegExp(link.regex, 'i').test('Sockets: B-B-B-B-R G'))
  const arm = new RegExp(ir.itemRegexParts({ ...chest, text: 'Armour: 950\nEvasion Rating: 320' }).find(p => p.label === 'Armour: 950').regex, 'i')
  assert.ok(arm.test('Armour: 1200')); assert.ok(!arm.test('Armour: 900')); assert.ok(!arm.test('Evasion Rating: 990'))
})

test('All tab layout: auto switches to Mapping on maps, Levelling on a new character', async () => {
  const lp = await import('./.build/layout-phase.mjs')
  assert.equal(lp.phaseForArea('MapWorldsStrand'), 'mapping')
  assert.equal(lp.phaseForArea('MapWorldsHideout'), null)
  assert.equal(lp.phaseForArea('HideoutCoven'), null)
  assert.equal(lp.phaseForArea('1_1_1'), 'levelling')
  assert.equal(lp.phaseForArea('1_2_1'), null)
  assert.equal(lp.phaseForArea('2_6_town'), null)
  assert.equal(lp.phaseForArea(undefined), null)
  assert.equal(lp.effectiveMode('auto', 'mapping'), 'mapping')
  assert.equal(lp.effectiveMode('levelling', 'mapping'), 'levelling')
})

test('poe.ninja categories: new slugs land in a Market group and atlas value', async () => {
  const mt = await import('./.build/market-trends.mjs')
  const av = await import('./.build/atlas-value.mjs')
  const group = c => mt.MARKET_GROUPS.filter(g => g.id !== 'all' && g.match(c)).map(g => g.id)
  for (const [c, id] of [['threads', 'league'], ['viscera', 'league'], ['wombgifts', 'league'], ['scrying-orbs', 'league'],
    ['memories', 'league'], ['temples', 'league'], ['shrine-belts', 'uniques'], ['forbidden-jewels', 'uniques'],
    ['imbued-gems', 'gems'], ['valdo-maps', 'maps'], ['flasks', 'bases'], ['cluster-jewels', 'bases'], ['scarabs', 'scarabs']]) {
    assert.deepEqual(group(c), [id], c)
  }
  const v = av.contentValues([{ name: 'Mysterious Wombgift', chaos: 20, category: 'wombgifts' }])
  assert.equal(v.breach.chaos, 20)
})

test('Mapping layout: tree map added once to saved layouts, above Build', async () => {
  const lp = await import('./.build/layout-phase.mjs')
  const l = { cols: [{ items: [{ id: 'session', h: 1 }] }, { items: [{ id: 'gear', h: 0.6 }, { id: 'money', h: 0.4 }] }] }
  lp.addTreeMapOnce(l)
  assert.deepEqual(l.cols[1].items.map(i => i.id), ['tree', 'gear', 'money'])
  lp.addTreeMapOnce(l)
  assert.equal(l.cols[1].items.filter(i => i.id === 'tree').length, 1)
  const noGear = { cols: [{ items: [{ id: 'atlas', h: 1 }] }] }
  assert.deepEqual(lp.addTreeMapOnce(noGear).cols[0].items.map(i => i.id), ['atlas', 'tree'])
})

test('atlas taken: grows from the start, never fills a path to a far same-named passive', async () => {
  const { pickTaken } = await import('./.build/atlas-taken.mjs')
  // start 0 - 1(Drop) - 2(Small) - 3(Small) - 4(Drop) ; 0 - 5(Drop) off the build
  const names = { 1: 'Drop', 2: 'Small', 3: 'Small', 4: 'Drop', 5: 'Drop' }
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5]]
  const adj = id => edges.flatMap(([a, b]) => a === id ? [b] : b === id ? [a] : [])
  const depth = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 1 }
  const pick = (build, counts) => [...pickTaken(build, counts, id => names[id], adj, id => id === 0, id => depth[id])].sort()
  // one Drop taken: only the one next to the start
  assert.deepEqual(pick([0, 1, 2, 3, 4], { Drop: 1 }), [0, 1])
  // build goes the other way: its first Drop is far away -> nothing shown, no path filled
  assert.deepEqual(pick([0, 5, 2, 3, 4], { Drop: 1 }), [0, 5])
  assert.deepEqual(pick([0, 2, 3, 4], { Drop: 1 }), [0])
  // the whole line taken
  assert.deepEqual(pick([0, 1, 2, 3, 4], { Drop: 2, Small: 2 }), [0, 1, 2, 3, 4])
})

test('tree steps: clamp, stable key, first position from old tracking', async () => {
  const t = await import('./.build/tree-step-logic.mjs')
  assert.equal(t.clampStep(3, 5, 6), 6)
  assert.equal(t.clampStep(3, -5, 6), 0)
  assert.equal(t.clampStep(2, 1, 6), 3)
  assert.equal(t.orderKey('tree', [1, 2, 3]), t.orderKey('tree', [1, 2, 3]))
  assert.notEqual(t.orderKey('tree', [1, 2, 3]), t.orderKey('tree', [1, 3, 2]))
  assert.notEqual(t.orderKey('tree', [1]), t.orderKey('atlas', [1]))
  assert.equal(t.leadingTaken(5, i => [0, 1, 3].includes(i)), 2)
  assert.equal(t.leadingTaken(3, () => true), 3)
})

test('gear defences read from item text', async () => {
  const { itemDefences } = await import('./.build/item-defences.mjs')
  const t = 'Item Class: Shields\nRarity: Rare\nX\nTitanium Spirit Shield\n--------\nChance to Block: 24%\nEnergy Shield: 132 (augmented)\n--------\nItem Level: 80'
  assert.deepEqual(itemDefences(t).map(d => `${d.short} ${d.value}`), ['Block 24%', 'ES 132'])
  assert.deepEqual(itemDefences('Rarity: Rare\nArmour: 500\nEvasion Rating: 480'), [{ name: 'Armour', short: 'AR', value: '500' }, { name: 'Evasion Rating', short: 'EV', value: '480' }])
  assert.deepEqual(itemDefences(undefined), [])
})

const STAGES = `<PathOfBuilding>
  <Build level="90" className="Witch" ascendClassName="Elementalist" mainSocketGroup="1"></Build>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="Early"><Skill enabled="true"><Gem nameSpec="Winter Orb" level="20" enabled="true"/><Gem nameSpec="Elemental Overload" level="20" enabled="true"/></Skill></SkillSet>
    <SkillSet id="2" title="Pcharge"><Skill enabled="true"><Gem nameSpec="Winter Orb" level="21" enabled="true"/><Gem nameSpec="Power Charge On Critical Support" level="20" enabled="true"/></Skill></SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec title="Early" classId="3" ascendClassId="2" treeVersion="3_30" nodes="1,2,3"/>
    <Spec title="Pcharge" classId="3" ascendClassId="3" treeVersion="3_30" nodes="1,2,4,5"/>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
New Item
Vaal Regalia
</Item>
    <Item id="2">
Rarity: RARE
Doom Shell
Vaal Regalia
+90 to maximum Life
</Item>
    <Item id="3">
Rarity: NORMAL
Greater Engorged Eye
</Item>
    <Item id="4">
Rarity: RARE
Grim Cowl
Hubris Circlet
+40 to maximum Energy Shield
</Item>
    <ItemSet id="1" title="Early"><Slot name="Body Armour" itemId="2"/><Slot name="Helmet" itemId="4"/></ItemSet>
    <ItemSet id="2" title="Pcharge"><Slot name="Body Armour" itemId="1"/><Slot name="Head" itemId="3"/></ItemSet>
  </Items>
</PathOfBuilding>`

test('loadouts: options, stage changes with placeholders, class switch and Wickerman', async () => {
  const st = await import('./.build/loadout-steps.mjs')
  const lo = {
    trees: [{ id: 1, title: 'Early' }, { id: 2, title: 'Pcharge' }],
    itemSets: [{ id: 1, title: 'Early' }, { id: 2, title: 'Pcharge' }],
    skillSets: [{ id: 1, title: 'Early' }, { id: 2, title: 'Pcharge' }],
    named: ['Early', 'Pcharge'],
    active: { spec: 1, itemSet: 1, skillSet: 1, named: 'Early' }
  }
  const opts = st.loadoutOptions(lo)
  assert.deepEqual(opts.map(o => o.label), ['Early', 'Pcharge'])
  assert.deepEqual(opts[1].sel, { spec: 2, itemSet: 2, skillSet: 2 })
  assert.equal(st.currentOption(lo, opts).label, 'Early')
  // single snapshot (poe.ninja): nothing to compare
  assert.deepEqual(st.loadoutOptions({ trees: [{ id: 1, title: '' }], itemSets: [{ id: 1, title: '' }], skillSets: [], named: [], active: { spec: 1, itemSet: 1, skillSet: 1 } }), [])
  // trees only (Level 30 / 60 / 90): gear and skills stay the active ones
  const treesOnly = st.loadoutOptions({ trees: [{ id: 1, title: 'Lvl 30' }, { id: 2, title: 'Lvl 90' }], itemSets: [{ id: 1, title: '' }], skillSets: [], named: [], active: { spec: 1, itemSet: 1, skillSet: 1 } })
  assert.deepEqual(treesOnly.map(o => [o.label, o.own.items]), [['Lvl 30', false], ['Lvl 90', false]])

  const a = buildXml.parseBuildXml(STAGES, { spec: 1, itemSet: 1, skillSet: 1 })
  const b = buildXml.parseBuildXml(STAGES, { spec: 2, itemSet: 2, skillSet: 2 })
  assert.equal(a.sets.spec, 'Early')
  const c = st.stageChanges(a, b)
  assert.equal(c.ascendancyChanges, true)
  assert.equal(c.classChanges, false)
  assert.deepEqual(c.take, [4, 5])
  assert.deepEqual(c.refund, [3])
  assert.deepEqual(c.gems.map(g => `${g.change}:${g.name}`), ['removed:Elemental Overload', 'added:Power Charge On Critical Support', 'level:Winter Orb'])
  // placeholder Vaal Regalia on the same base: nothing to do; helmet missing in target: keep yours
  assert.deepEqual(c.gear, [])
  assert.deepEqual(c.wickerman.map(w => w.to), ['Greater Engorged Eye'])
  assert.deepEqual(st.wickermanOf(b), [{ slot: 'Head', name: 'Greater Engorged Eye' }])
  assert.equal(st.stageChanges(a, a).nothing, true)
})

test('compare: mods matched by wording, values compared', async () => {
  const { matchMods } = await import('./.build/build-compare.mjs')
  const m = matchMods(['+70 to maximum Life', '+40% to Fire Resistance', '10% reduced Mana Cost of Skills', 'Adds 1 to 2 Cold Damage'],
    ['+90 to maximum Life', '+40% to Fire Resistance', '15% reduced Mana Cost of Skills', '+1 to Level of all Spell Skill Gems'])
  assert.deepEqual(m.both, ['+40% to Fire Resistance'])
  assert.deepEqual(m.aLower.map(x => x.a), ['+70 to maximum Life', '10% reduced Mana Cost of Skills'])
  assert.deepEqual(m.aHigher.map(x => x.a), [])
  assert.deepEqual(m.onlyA, ['Adds 1 to 2 Cold Damage'])
  assert.deepEqual(m.onlyB, ['+1 to Level of all Spell Skill Gems'])
})

const gemsMod = await import('./.build/gems.mjs')
const myChar = await import('./.build/my-character.mjs')
test('my character file: Gems tab reads the PoB-imported copy', () => {
  assert.equal(myChar.legacyPathOf('Storm Burst.xml'), 'Storm Burst (my character).xml')
  assert.equal(myChar.planPathOf('X (my character).xml', ['X.xml'], null), 'X.xml')
  const it = buildXml.parseItemText('Rarity: RARE\nDoom Hood\nHubris Circlet\nSockets: B-B-B R\nLevelReq: 69\n+90 to maximum Life')
  assert.equal(it.sockets, 'B-B-B R')
  assert.deepEqual(it.mods, ['+90 to maximum Life'])
  const live = gemsMod.liveFromSummary({
    stats: {},
    groups: [{ slot: 'Helmet', enabled: true, gems: [{ name: 'Storm Burst', level: 18, quality: 5, enabled: true }] }],
    items: [{ slot: 'Helmet', rarity: 'Rare', name: 'Doom Hood', base: 'Hubris Circlet', mods: [], sockets: 'B-B-B R' }, { slot: 'Ring 1', rarity: 'Rare', name: 'R', base: 'Ruby Ring', mods: [] }],
    tree: { nodes: [], masteries: {} }
  })
  assert.equal(live.groups[0].index, 0)
  assert.equal(live.groups[0].gems[0].support, false)
  assert.deepEqual(live.items, [{ slot: 'Helmet', name: 'Doom Hood', baseName: 'Hubris Circlet', sockets: 'B-B-B R' }])
  const cmp = gemsMod.compareGems([{ index: 0, slot: 'Helmet', enabled: true, gems: [{ name: 'Storm Burst', level: 20, quality: 20, enabled: true, support: false }, { name: 'Faster Casting', level: 20, enabled: true, support: true }] }], live.groups)
  assert.equal(cmp.lowCount, 1)
  assert.equal(cmp.missingCount, 1)
})

test('my character file: named after the character, linked, survives build renames', () => {
  const m = myChar
  assert.equal(m.charFilePath('Deathloom_Totems'), 'My characters/Deathloom_Totems.xml')
  assert.equal(m.safeCharName('a/b:c. '), 'a_b_c')
  // Windows paths from the builds list, any letter case
  const builds = ['3.30\\Storm Burst.xml', 'My characters\\deathloom_totems.xml', 'Old (my character).xml']
  let r = m.resolveMine('Deathloom_Totems', builds, {}, '3.30\\Storm Burst.xml')
  assert.deepEqual(r, { path: 'My characters\\deathloom_totems.xml', how: 'named', legacy: null })
  // build renamed: still found (the file doesn't depend on the build's name)
  r = m.resolveMine('Deathloom_Totems', ['3.30\\Storm Burst v2.xml', ...builds.slice(1)], {}, '3.30\\Storm Burst v2.xml')
  assert.equal(r.how, 'named')
  // link wins; a dead link falls back to the name
  const links = m.withLink({}, 'Deathloom_Totems', 'Old (my character).xml')
  assert.equal(m.resolveMine('deathloom_totems', builds, links, null).path, 'Old (my character).xml')
  assert.equal(m.resolveMine('Deathloom_Totems', builds.slice(0, 2), links, null).how, 'named')
  assert.deepEqual(m.withLink(links, 'DEATHLOOM_TOTEMS', null), {})
  // nothing set up: offer the old copy of the active build first
  r = m.resolveMine('Other', ['A.xml', 'A (my character).xml', 'Z (my character).xml'], {}, 'Z.xml')
  assert.deepEqual(r, { path: null, how: null, legacy: 'Z (my character).xml' })
  assert.equal(m.resolveMine('', ['A.xml'], {}, 'A.xml').legacy, null)
  assert.deepEqual(m.characterFiles(builds), ['My characters\\deathloom_totems.xml', 'Old (my character).xml'])
  // active is the character file (opened in PoB): plan = last followed build
  assert.equal(m.planPathOf('My characters\\x.xml', builds, '3.30\\Storm Burst.xml'), '3.30\\Storm Burst.xml')
  assert.equal(m.planPathOf('A.xml', builds, 'B.xml'), 'A.xml')
})

test('gems merged view: status, change now, locked', async () => {
  const gm = await import('./.build/gems-merged.mjs')
  const build = [
    { index: 0, slot: 'Helmet', enabled: true, gems: [
      { name: 'Storm Burst', level: 20, quality: 20, enabled: true, support: false },
      { name: 'Spell Totem Support', level: 20, enabled: true, support: true },
      { name: 'Awakened Added Lightning Damage Support', level: 1, enabled: true, support: true }] },
    { index: 1, slot: 'Boots', enabled: true, gems: [{ name: 'Flame Dash', level: 10, enabled: true, support: false }] }
  ]
  const mine = [{ index: 0, slot: 'Helmet', enabled: true, gems: [
    { name: 'Storm Burst', level: 18, quality: 0, enabled: true, support: false },
    { name: 'Spell Totem', level: 20, enabled: true, support: false },
    { name: 'Rolling Magma', level: 10, enabled: true, support: false }] }]
  const req = new Map([['storm burst', 12], ['spell totem', 8], ['awakened added lightning damage', 72], ['flame dash', 10]])
  const rows = gemsMod.compareGems(build, mine).groups
  const input = { rows, level: 30, reqLevels: req, source: 'mine', ticks: new Set(), mineReady: true }
  const st = gm.mergedRows(input).flatMap(r => r.gems.map(g => `${g.name}:${g.status}`))
  assert.deepEqual(st, ['Storm Burst:low', 'Spell Totem Support:have', 'Awakened Added Lightning Damage Support:locked', 'Flame Dash:missing'])
  const plan = (name, reqLevel, slot) => ({ name, reqLevel, slot, support: false })
  const ch = gm.changeNow(input, {
    now: [plan('Storm Burst', 12), plan('Flame Dash', 10, 'Boots'), plan('Flame Dash', 10), plan('Awakened Added Lightning Damage Support', 72)],
    drop: [plan('Rolling Magma', 1), plan('Freezing Pulse', 1)],
    charGems: new Set(mine[0].gems.map(g => gm.gemKey(g.name)))
  })
  assert.deepEqual(ch.takeOut, ['Rolling Magma'])
  assert.deepEqual(ch.socket.map(g => g.name), ['Flame Dash'])
  assert.deepEqual(ch.levelUp, [{ name: 'Storm Burst', have: '18/0', want: '20/20' }])
  assert.equal(ch.total, 3)
  // ticks: ticked = have, nothing to level up, take out only what's ticked
  const tin = { ...input, source: 'ticks', ticks: new Set(['Storm Burst', 'Freezing Pulse']), mineReady: false }
  assert.deepEqual(gm.mergedRows(tin)[0].gems.map(g => g.status), ['have', 'missing', 'locked'])
  const ct = gm.changeNow(tin, { now: [plan('Storm Burst', 12), plan('Flame Dash', 10)], drop: [plan('Rolling Magma', 1), plan('Freezing Pulse', 1)], charGems: new Set() })
  assert.deepEqual([ct.takeOut, ct.socket.map(g => g.name), ct.levelUp], [['Freezing Pulse'], ['Flame Dash'], []])
  // my character not read yet: nothing to change, statuses unknown (locked still shows)
  const none = { ...input, mineReady: false }
  assert.equal(gm.changeNow(none, { now: [plan('Flame Dash', 10)], drop: [], charGems: new Set() }).total, 0)
  assert.deepEqual(gm.mergedRows(none)[0].gems.map(g => g.status), ['unknown', 'unknown', 'locked'])
  // no plan: socket comes from the gear pieces' missing gems
  assert.deepEqual(gm.changeNow(input, { now: [], drop: [], charGems: new Set() }).socket.map(g => g.name), ['Flame Dash'])
  assert.deepEqual(gm.countStatus(gm.mergedRows(input)), { have: 1, low: 1, missing: 1, locked: 1, unknown: 0 })
})
