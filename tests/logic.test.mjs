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
  assert.deepEqual(helm.onlyA, ['+80 to maximum Life']); assert.deepEqual(helm.onlyB, ['+90 to maximum Life'])
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
