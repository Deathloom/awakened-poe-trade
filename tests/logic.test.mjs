import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const store = {}
globalThis.localStorage = {
  get length () { return Object.keys(store).length },
  key: i => Object.keys(store)[i] ?? null,
  getItem: k => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] }
}

const guard = await import('./.build/request-guard.mjs')
const buildFiles = await import('./.build/build-files.mjs')
const session = await import('./.build/play-session.mjs')
const money = await import('./.build/money.mjs')
const tools = await import('./.build/settings-tools.mjs')
const search = await import('./.build/search-strings.mjs')
const sheets = await import('./.build/sheets.mjs')
const buildXml = await import('./.build/build-xml.mjs')
const compare = await import('./.build/build-compare.mjs')
const game = await import('./.build/game.mjs')

test('request guard: what a phone may ask for', () => {
  const ok = guard.allowedFromOtherDevice
  assert.equal(ok('CLIENT->MAIN::pob-gems', { requestId: 1 }), true)
  assert.equal(ok('CLIENT->MAIN::build-notes', {}), true)
  assert.equal(ok('CLIENT->MAIN::save-config', { contents: '{}' }), false)
  assert.equal(ok('CLIENT->MAIN::update-host-config', {}), false)
  assert.equal(ok('CLIENT->MAIN::tools', { op: 'remote-set' }), false)
  assert.equal(ok('CLIENT->MAIN::pob-copy-builds', { source: 'C:/' }), false)
  assert.equal(ok('CLIENT->MAIN::user-action', { action: 'open-trade-tab', url: 'x' }), true)
  assert.equal(ok('CLIENT->MAIN::user-action', { action: 'chat-command', text: '/hideout' }), false)
  assert.equal(ok('CLIENT->MAIN::user-action', { action: 'quit' }), false)
  assert.equal(ok('CLIENT->MAIN::user-action', null), false)
  assert.equal(ok('CLIENT->MAIN::pob-sync', { op: 'pull' }), true)
  assert.equal(ok('CLIENT->MAIN::pob-sync', { op: 'signOut' }), false)
  assert.equal(ok('CLIENT->MAIN::pob-sync', { op: 'configure', player: '..' }), false)
})

test('request guard: overlay events reach main (price check), not from phones', () => {
  assert.equal(guard.isClientEvent('OVERLAY->MAIN::track-area'), true)
  assert.equal(guard.isClientEvent('OVERLAY->MAIN::focus-game'), true)
  assert.equal(guard.isClientEvent('CLIENT->MAIN::pob-gems'), true)
  assert.equal(guard.isClientEvent('MAIN->CLIENT::pob-gems'), false)
  assert.equal(guard.isClientEvent(undefined), false)
  assert.equal(guard.allowedFromOtherDevice('OVERLAY->MAIN::track-area', {}), false)
})

// Deathloom fork (S1): the phone list is an allow-list, so every event a window
// can send must be sorted into allowed or refused, and every name the pages send
// must get past isClientEvent (dropping OVERLAY->MAIN:: once broke price check).
const ipcTypes = readFileSync(join(root, 'ipc/types.ts'), 'utf8')
const declaredEvents = (prefix) => [...new Set([...ipcTypes.matchAll(new RegExp(`'(${prefix}::[a-z0-9-]+)'`, 'g'))].map(m => m[1]))]

function rendererSources (dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) rendererSources(p, out)
    else if (/\.(ts|vue)$/.test(e.name)) out.push(readFileSync(p, 'utf8'))
  }
  return out
}

test('request guard (S1): every CLIENT->MAIN event is either allowed or refused from phones', () => {
  const events = declaredEvents('CLIENT->MAIN')
  assert.ok(events.length > 30, `found only ${events.length} events in ipc/types.ts`)
  for (const name of events) {
    const allowed = guard.FROM_OTHER_DEVICES.has(name)
    const refused = guard.NOT_FROM_OTHER_DEVICES.has(name)
    assert.ok(allowed !== refused, `${name}: add it to exactly one of FROM_OTHER_DEVICES / NOT_FROM_OTHER_DEVICES in main/src/request-guard.ts`)
    if (refused) assert.equal(guard.allowedFromOtherDevice(name, {}), false, name)
  }
  // no stale names in the lists
  for (const name of [...guard.FROM_OTHER_DEVICES, ...guard.NOT_FROM_OTHER_DEVICES]) {
    assert.ok(events.includes(name), `${name} is listed in request-guard.ts but not declared in ipc/types.ts`)
  }
  // default deny: an event nobody sorted yet is refused
  assert.equal(guard.allowedFromOtherDevice('CLIENT->MAIN::some-new-event', {}), false)
  for (const name of declaredEvents('OVERLAY->MAIN')) {
    assert.equal(guard.allowedFromOtherDevice(name, {}), false, name)
  }
})

test('request guard (S1): every event name the pages send gets past isClientEvent', () => {
  const declared = new Set([...declaredEvents('CLIENT->MAIN'), ...declaredEvents('OVERLAY->MAIN')])
  const sent = new Set()
  for (const src of rendererSources(join(root, 'renderer/src'))) {
    for (const m of src.matchAll(/name:\s*'([A-Z]+->MAIN::[a-z0-9-]+)'/g)) sent.add(m[1])
  }
  assert.ok(sent.size > 30, `found only ${sent.size} sent event names`)
  for (const name of sent) {
    assert.equal(guard.isClientEvent(name), true, name)
    assert.ok(declared.has(name), `${name} is sent by the renderer but not declared in ipc/types.ts`)
  }
})

test('request guard: loopback always, other devices only with the key', () => {
  const K = 'k'.repeat(32)
  const opts = { listenHost: '0.0.0.0', remoteKey: K }
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284' }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284' }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: K }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: 'x'.repeat(32) }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: '192.168.1.9:47284', key: K }, {}), false)
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', secFetchSite: 'cross-site' }, {}), false)
  // F1: another device can't skip the key by sending Host: 127.0.0.1 / localhost
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', remoteAddress: '192.168.1.9' }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: 'localhost:47284', remoteAddress: '::ffff:192.168.1.9' }, opts), false)
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', remoteAddress: '192.168.1.9', key: K }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', remoteAddress: '192.168.1.9', key: K }, {}), false)
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', remoteAddress: '' }, opts), false)
  // this PC itself: no key
  assert.equal(guard.isAllowedRequest({ host: '127.0.0.1:47284', remoteAddress: '127.0.0.1' }, opts), true)
  assert.equal(guard.isAllowedRequest({ host: 'localhost:47284', remoteAddress: '::ffff:127.0.0.1' }, {}), true)
  assert.equal(guard.isAllowedRequest({ host: '[::1]:47284', remoteAddress: '::1' }, {}), true)
  assert.equal(guard.isLoopbackAddress('127.0.0.1'), true)
  assert.equal(guard.isLoopbackAddress('::ffff:127.0.0.1'), true)
  assert.equal(guard.isLoopbackAddress('10.0.0.127'), false)
  assert.equal(guard.isLoopbackAddress(undefined), false)
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

test('backup restore (Q24): pick what to take, keep this PC\'s folders, no prototype keys', () => {
  const theirs = { configVersion: 18, clientLog: 'D:/Their/Client.txt', overlayKey: 'F1', widgets: [], pob: { pobDir: 'D:/TheirPoB', buildsDir: 'D:/b', gearPanelKey: 'F2' } }
  const b = JSON.stringify({ kind: 'orbhoarder-backup', v: 1, createdAt: '2026-11-27T10:00:00Z', config: theirs, local: { 'deathloom.q24': 'x', 'other.key': 'y' } })
  const mine = () => ({ configVersion: 18, clientLog: 'C:/Mine/Client.txt', gameConfig: null, overlayKey: 'Shift + Space', widgets: [{ a: 1 }], pob: { pobDir: 'C:/PoB', buildsDir: 'C:/b', gearPanelKey: null } })
  const s = tools.backupSummary(b, mine())
  assert.equal(s.ok, true)
  assert.equal(s.createdAt, '2026-11-27')
  assert.equal(s.panelData, 1)
  assert.deepEqual(s.otherPaths, ['clientLog', 'pob.pobDir', 'pob.buildsDir'])
  // keep folders: their hotkeys, my paths
  let into = mine()
  delete store['deathloom.q24']
  assert.equal(tools.readBackup(b, into, { settings: true, panelData: false, keepPaths: true }).ok, true)
  assert.equal(into.overlayKey, 'F1')
  assert.equal(into.pob.gearPanelKey, 'F2')
  assert.equal(into.clientLog, 'C:/Mine/Client.txt')
  assert.equal(into.pob.pobDir, 'C:/PoB')
  assert.equal(store['deathloom.q24'], undefined)
  // panel data only: settings untouched
  into = mine()
  tools.readBackup(b, into, { settings: false, panelData: true, keepPaths: false })
  assert.equal(into.overlayKey, 'Shift + Space')
  assert.equal(store['deathloom.q24'], 'x')
  assert.equal(store['other.key'], undefined)
  // a hand-made file can't swap the settings object's prototype or change a value's kind
  const evil = '{"kind":"orbhoarder-backup","config":{"configVersion":18,"__proto__":{"polluted":1},"widgets":{"not":"a list"},"overlayKey":"F3"}}'
  into = mine()
  assert.equal(tools.readBackup(evil, into).ok, true)
  assert.equal(into.polluted, undefined)
  assert.equal(Object.getPrototypeOf(into), Object.prototype)
  assert.deepEqual(into.widgets, [{ a: 1 }])
  assert.equal(into.overlayKey, 'F3')
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
  // the route is loaded on first need (F4): before that nothing moves or gets saved
  assert.equal(route.routeLoaded(), false)
  assert.equal(route.findStep('The Coast', 0), -1)
  assert.equal(route.loadCampaignStep(), 0)
  route.saveStepForChar('Early', 3)
  assert.deepEqual(route.loadStepByChar(), {})
  const p = route.loadRoute()
  assert.equal(route.loadRoute(), p)
  await p
  assert.ok(route.routeLoaded() && route.STEPS.length > 100)
  const n = route.STEPS.length
  await route.loadRoute()
  assert.equal(route.STEPS.length, n)
  assert.equal(route.questPassivesTotal('BANDIT_KILL'), 24)
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

test('bench recipes (Q9): places from the route, manual account-wide ticks', async () => {
  const bench = await import('./.build/bench-recipes.mjs')
  const { readFileSync } = await import('node:fs')
  const { steps } = JSON.parse(readFileSync(new URL('../renderer/src/web/companion/campaign-route.json', import.meta.url), 'utf8'))
  const spots = bench.benchRecipeSpots(steps)
  // every recipe once, in route order, at a step that really lists it
  assert.ok(spots.length >= 40)
  assert.equal(new Set(spots.map(s => s.recipe)).size, spots.length)
  for (let i = 1; i < spots.length; i++) assert.ok(spots[i].step >= spots[i - 1].step)
  for (const s of spots) {
    assert.ok(bench.stepRecipes(steps[s.step]).includes(s.recipe), s.recipe)
    assert.equal(steps[s.step].zone, s.zone)
  }
  // the labyrinth's "crafting" parts carry no recipe
  const lab = steps.find(st => st.areaId === 'Labyrinth_Airlock' && st.tasks.some(t => t.parts.some(p => p.k === 'crafting')))
  assert.ok(lab)
  assert.deepEqual(bench.stepRecipes(lab), [])
  assert.deepEqual(bench.stepRecipes(undefined), [])
  // optional quests switched off in the guide: their recipes aren't listed
  const regen = 'Life and Mana Regeneration - Rank 1'
  assert.ok(spots.some(s => s.recipe === regen && s.zone === 'The Archives'))
  const noOptional = bench.benchRecipeSpots(steps, o => o !== 'OPTIONAL')
  assert.ok(!noOptional.some(s => s.zone === 'The Archives'))
  assert.ok(noOptional.length < spots.length && noOptional.length > 0)
  const caverns = spots.find(s => s.recipe === 'Vaal Skill Damage - Rank 1')
  assert.equal(caverns.zone, 'The Caverns')
  assert.equal(caverns.act, 2)
  // grouped per act; the route's act 11 is the epilogue town
  const groups = bench.spotsByAct(spots)
  assert.equal(groups.reduce((n, g) => n + g.spots.length, 0), spots.length)
  assert.equal(bench.actLabel(11), 'Epilogue')
  assert.equal(bench.actLabel(3), 'Act 3')
  // next / passed relative to the guide's step
  const none = new Set()
  assert.equal(bench.nextUnfound(spots, none, 0), spots[0])
  assert.deepEqual(bench.passedUnfound(spots, none, 0), [])
  const at = spots[2].step
  assert.equal(bench.nextUnfound(spots, new Set([spots[2].recipe]), at), spots[3])
  assert.deepEqual(bench.passedUnfound(spots, new Set([spots[0].recipe]), at).map(s => s.recipe), [spots[1].recipe])
  assert.equal(bench.nextUnfound(spots, new Set(spots.map(s => s.recipe)), 0), null)
  // ticks: saved, toggled, junk dropped
  assert.equal(bench.loadBenchTicks().size, 0)
  assert.equal(bench.toggleBenchTick('Spell Damage - Rank 1').has('Spell Damage - Rank 1'), true)
  assert.equal(bench.toggleBenchTick('Spell Damage - Rank 1').size, 0)
  localStorage.setItem(bench.BENCH_KEY, JSON.stringify(['A', 5, '', 'A', 'x'.repeat(500), { a: 1 }, 'B']))
  assert.deepEqual([...bench.loadBenchTicks()], ['A', 'B'])
  localStorage.setItem(bench.BENCH_KEY, 'not json')
  assert.equal(bench.loadBenchTicks().size, 0)
  localStorage.setItem(bench.BENCH_KEY, '{"a":1}')
  assert.equal(bench.loadBenchTicks().size, 0)
  localStorage.removeItem(bench.BENCH_KEY)
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

test('market tools: shopping list, sell list, farming, crafting, divine', async () => {
  const mt = await import('./.build/market-tools.mjs')
  const L = (ns, name, chaos, variant, graph = [0, 0, 0, 0, 0, 0, 0]) => ({ ns, name, chaos, variant, graph, category: 'x', url: 'u' })
  const items = [
    L('UNIQUE', 'Wickerman', 50), L('UNIQUE', 'Wickerman', 80, '6L'),
    L('GEM', 'Arc', 5, '20/20'), L('GEM', 'Arc', 1, '1'), L('GEM', 'Arc', 0.5, '21/20c'),
    L('GEM', 'Only Corrupt', 9, '21c'),
    L('ITEM', 'Divine Orb', 150), L('ITEM', 'Orb of Alteration', 0.2)
  ]
  // cheapest: lowest price, corrupted gems only when nothing else
  assert.equal(mt.cheapestByName(items, 'GEM', 'arc').chaos, 1)
  assert.equal(mt.cheapestByName(items, 'GEM', 'Only Corrupt').chaos, 9)
  assert.equal(mt.cheapestByName(items, 'UNIQUE', 'Wickerman').chaos, 50)

  const shop = mt.shoppingList(
    [{ slot: 'Ring 1', name: 'Wickerman', unique: true, owned: false }, { slot: 'Ring 2', name: 'Wickerman', unique: true, owned: true },
      { slot: 'Helmet', name: 'Rare thing', unique: false, owned: false }, { slot: 'Boots', name: 'Unknown Unique', unique: true, owned: false }],
    [{ name: 'Arc', enabled: true }, { name: 'Arc', enabled: true }, { name: 'Off Gem', enabled: false }],
    items, new Set())
  assert.equal(shop.rows.length, 4) // Wickerman (merged slots), Unknown Unique, Arc, the rare (own row, no price)
  assert.equal(shop.rows.find(r => r.kind === 'rare').label, 'Rare thing')
  assert.deepEqual(shop.rows.find(r => r.label === 'Wickerman').slots, ['Ring 1', 'Ring 2'])
  assert.equal(shop.rows.find(r => r.label === 'Wickerman').owned, false) // one slot still missing
  assert.equal(shop.total, 51)
  assert.equal(shop.missing, 1)
  assert.equal(shop.rares, 1)
  assert.equal(mt.shoppingList([], [{ name: 'Arc', enabled: true }], items, new Set(['arc'])).total, 0)

  assert.equal(mt.priceNote(300, 150), '~price 2 divine')
  assert.equal(mt.priceNote(44.6, 150, '~b/o'), '~b/o 45 chaos')
  assert.equal(mt.priceNote(0.2, 150), '~price 1 chaos')
  assert.deepEqual(mt.sellTotal([{ qty: 2 }, { qty: 1 }], e => e.qty === 2 ? 10 : null), { chaos: 20, missing: 1 })
  assert.equal(mt.sellHint(L('ITEM', 'x', 80, undefined, [0, -5, -10, -15, -20])).tone, 'sell')
  assert.equal(mt.sellHint(L('ITEM', 'x', 120, undefined, [0, 5, 10, 15, 20])).tone, 'wait')
  assert.equal(mt.sellHint(L('ITEM', 'x', 100, undefined, [0, 1])), null) // too few days

  const runs = mt.runsFromSession([
    { seed: 'a', code: 'MapX', start: 1, ms: 6 * 60_000, mechanics: ['Breach'], loot: 60, strategy: 'Breach' },
    { seed: 'b', code: 'MapX', start: 2, ms: 6 * 60_000, mechanics: [], loot: 20 },
    { seed: 'c', code: 'MapX', start: 3, ms: 6 * 60_000, mechanics: ['Breach'] }, // no loot typed: left out
    { seed: 'd', code: 'MapX', start: 4, ms: 0, mechanics: [], loot: 5 } // not finished
  ], 10, 'Covens')
  assert.equal(runs.length, 2)
  assert.equal(runs[1].strategy, 'No strategy set')
  assert.equal(runs[0].league, 'Covens')
  const st = mt.farmingStats(runs, 'strategy')
  assert.equal(st[0].name, 'Breach')
  assert.equal(st[0].perMap, 50)
  assert.equal(Math.round(st[0].perHour), 500)
  assert.equal(mt.farmingStats(runs, 'mechanic').find(s => s.name === 'No mechanic seen').maps, 1)
  assert.equal(mt.mergeRuns(runs, [{ ...runs[0], loot: 99 }]).length, 2)
  assert.equal(mt.mergeRuns(runs, [{ ...runs[0], loot: 99 }])[0].loot, 99)

  const price = n => ({ 'Orb of Alteration': 0.2 })[n] ?? null
  assert.deepEqual(mt.craftTotal([{ name: 'Orb of Alteration', count: 100 }, { name: 'Chaos Orb', count: 5 }, { name: 'Mystery', count: 1 }, { name: 'Zero', count: 0 }], price),
    { chaos: 25, missing: ['Mystery'] })
  assert.equal(mt.convert(300, 'chaos', 150), 2)
  assert.equal(mt.convert(2, 'div', 150), 300)
  assert.equal(mt.convert(2, 'div', undefined), null)
  assert.equal(mt.divineSeries(items[6]).length, 7)
})

test('market outlook: no cap; too-fast items flagged and left out; backtest on the week', async () => {
  const mt = await import('./.build/market-trends.mjs')
  // graph = % vs 7 days ago, oldest first; chaos = today
  const item = (chaos, graph) => ({ chaos, graph, name: 'x', ns: 'GEM', category: 'skill-gems', url: '' })
  // 1c → 15c in a week: too fast to call, not a steady climber
  const wild = mt.trendOf(item(15, [0, 100, 300, 600, 900, 1200, 1400]))
  assert.equal(wild.wild, true)
  assert.equal(mt.isSteadyClimber(wild), false)
  // steady +3%/day: a real number, not 60
  const g = [0, 1, 2, 3, 4, 5, 6].map(d => (1.03 ** d - 1) * 100)
  const steady = mt.trendOf(item(10 * 1.03 ** 6, g))
  assert.equal(steady.wild, false)
  assert.ok(steady.outlook > 3 && steady.outlook < 12, String(steady.outlook))
  assert.equal(mt.isSteadyClimber(steady), true)
  // backtest: steady climbers that kept climbing count as rose and within
  const s = mt.backtestSummary(Array.from({ length: 6 }, () => item(10 * 1.03 ** 6, g)))
  assert.equal(s.n, 6); assert.equal(s.rose, 6); assert.equal(s.within, 6)
  assert.ok(s.medianMiss < 5)
})

test('player folder name must be one plain folder (F1 review)', () => {
  const ok = buildFiles.safeSegment
  assert.equal(ok('Gerhard'), true)
  assert.equal(ok('deathloom-builds'), true)
  assert.equal(ok('..'), false)
  assert.equal(ok('a/b'), false)
  assert.equal(ok('..\\Windows'), false)
  assert.equal(ok('C:'), false)
  assert.equal(ok('.hidden'), false)
  assert.equal(ok('con'), false)
})

test('problem reports: home folder and secrets scrubbed in any spelling', async () => {
  const { scrubText, homePattern } = await import('./.build/report-scrub.mjs')
  const home = 'C:\\Users\\Gerhard'
  assert.equal(scrubText('at C:\\Users\\Gerhard\\Documents\\x.lua:3', home), 'at %USERPROFILE%\\Documents\\x.lua:3')
  assert.equal(scrubText('c:/users/gerhard/AppData', home), '%USERPROFILE%/AppData')
  assert.equal(scrubText('{"p":"C:\\\\Users\\\\GERHARD\\\\a"}', home), '{"p":"%USERPROFILE%\\\\a"}')
  // another user whose name starts the same stays (no partial match)
  assert.equal(scrubText('C:\\Users\\Gerhard2\\a', home), 'C:\\Users\\Gerhard2\\a')
  assert.equal(scrubText('/home/gerhard/.config', '/home/gerhard'), '%USERPROFILE%/.config')
  assert.equal(homePattern('C:\\'), null)
  assert.equal(scrubText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz', ''), 'Authorization: Bearer <token>')
  assert.equal(scrubText('x ghp_0123456789abcdefABCDEF y', home), 'x <token> y')
  assert.equal(scrubText('POESESSID=abc123def', home), 'POESESSID=<session>')
  assert.equal(scrubText('{"refresh_token":"r-123"}', home), '{"refresh_token":"<secret>"}')
})

test('phone key: sealed with Windows encryption, plain file migrated once', async () => {
  const ks = await import('./.build/remote-key-store.mjs')
  const KEY = 'abcdefghijklmnopqrstuvwxyz012345678_-AB'
  const mk = (init = {}) => {
    const disk = { ...init }
    return {
      disk,
      files: {
        read: n => disk[n] === undefined ? undefined : Buffer.from(disk[n]),
        write: (n, d) => { disk[n] = Buffer.from(d) },
        remove: n => { delete disk[n] }
      }
    }
  }
  const sealer = { available: () => true, encrypt: s => Buffer.from('X' + s), decrypt: b => { const s = b.toString(); if (s[0] !== 'X') throw new Error('bad'); return s.slice(1) } }
  const none = { available: () => false, encrypt: () => { throw new Error('no') }, decrypt: () => { throw new Error('no') } }
  // old plain file → same key, now sealed, plain file gone
  let m = mk({ [ks.PLAIN_FILE]: KEY + '\n' })
  assert.equal(ks.loadKey(m.files, sealer), KEY)
  assert.equal(m.disk[ks.PLAIN_FILE], undefined)
  assert.equal(m.disk[ks.SEALED_FILE].toString(), 'X' + KEY)
  assert.equal(ks.loadKey(m.files, sealer), KEY)
  // no encryption (some Linux): plain file kept and read as before
  m = mk({ [ks.PLAIN_FILE]: KEY })
  assert.equal(ks.loadKey(m.files, none), KEY)
  assert.equal(m.disk[ks.SEALED_FILE], undefined)
  ks.saveKey(m.files, none, KEY.replace('a', 'b'))
  assert.equal(m.disk[ks.PLAIN_FILE].toString(), KEY.replace('a', 'b'))
  // sealed file that can't be opened (other Windows user) and no plain file → new key
  m = mk({ [ks.SEALED_FILE]: 'garbage' })
  assert.equal(ks.loadKey(m.files, sealer), undefined)
  // invalid content never accepted
  m = mk({ [ks.PLAIN_FILE]: 'short' })
  assert.equal(ks.loadKey(m.files, sealer), undefined)
  // encryption throws while saving → falls back to the plain file
  m = mk()
  ks.saveKey(m.files, { available: () => true, encrypt: () => { throw new Error('x') }, decrypt: () => '' }, KEY)
  assert.equal(m.disk[ks.PLAIN_FILE].toString(), KEY)
})

test('atlas generator: type pickers only for picked content (Threads ≠ Ultimatum)', async () => {
  const { generateAtlas } = await import('./.build/atlas-generator.mjs')
  const { decodeAtlas, ATLAS_BY_ID } = await import('./.build/atlas-tree-test.mjs')
  const r = generateAtlas({ contents: ['strongbox', 'abyss', 'threads', 'divination'], sustain: false, budget: 150 })
  const spec = decodeAtlas(r.code)
  const name = id => ATLAS_BY_ID.get(id)?.[6].trim()
  const names = spec.nodes.map(name)
  // Dextral Threads offers only Breach / Ritual / Ultimatum / Expedition / Incursion: none picked
  assert.ok(!names.includes('Dextral Threads'), 'Dextral Threads taken without a picked type')
  // an Ultimatum node whose option rewards Divination cards still needs Ultimatum
  assert.ok(!names.includes("Trialmaster's Boon"))
  // Sinistral Threads, if taken, is set to Abyss (its 1st option)
  const sin = spec.nodes.find(id => name(id) === 'Sinistral Threads')
  if (sin != null) assert.equal(spec.choices[String(sin)] != null, true)
  const { subjectOf } = await import('./.build/atlas-generator.mjs')
  assert.equal(subjectOf('Strongboxes in your Maps can have a modifier to contain a Mercenary'), 'strongbox')
  assert.equal(subjectOf('Mercenaries found in your Maps are affected by a random Shrine buff'), 'mercenaries')
  const r2 = generateAtlas({ contents: ['threads'], sustain: false, budget: 150 })
  const n2 = decodeAtlas(r2.code).nodes.map(name)
  assert.ok(!n2.includes('Dextral Threads') && !n2.includes('Sinistral Threads'))
})

test('atlas generator: Beasts / Syndicate trees take the Bestiary / Betrayal Thread type notables', async () => {
  const { generateAtlas } = await import('./.build/atlas-generator.mjs')
  const { decodeAtlas, ATLAS, ATLAS_BY_ID } = await import('./.build/atlas-tree-test.mjs')
  const name = id => ATLAS_BY_ID.get(id)?.[6].trim()
  const option = (spec, id) => (ATLAS.variants[String(id)] ?? []).find(([e]) => e === spec.choices[String(id)])?.[1].join(' ') ?? ''
  for (const [content, thread] of [['beasts', 'Bestiary'], ['syndicate', 'Betrayal']]) {
    const r = generateAtlas({ contents: [content], sustain: false, budget: 150 })
    assert.ok(r.notables.includes('Sinistral Threads'), `${content}: Sinistral Threads`)
    assert.ok(r.notables.includes('Unthreaded'), `${content}: Unthreaded`)
    const spec = decodeAtlas(r.code)
    const sin = spec.nodes.find(id => name(id) === 'Sinistral Threads')
    assert.match(option(spec, sin), new RegExp(thread))
    // Unthreaded rules out another type, never your own
    const un = spec.nodes.find(id => name(id) === 'Unthreaded')
    assert.doesNotMatch(option(spec, un), new RegExp(thread))
  }
})

test('patch notes: newest forum thread, alert once, first check silent', async () => {
  const pn = await import('./.build/patch-notes.mjs')
  const html = `
    <tr><td class="thread"><div class="title"><a href="/forum/view-thread/4017726">3.30.0d Patch Notes</a></div>
      <a href="/forum/view-thread/4017726/page/3">3</a></td>
      <td class="last_post"><a href="/forum/view-thread/4017726/page/3#p1">Today</a></td></tr>
    <tr><td><div class="title"><a href="/forum/view-thread/4017887">3.30.0d Hotfix 2 &amp; more</a></div></td></tr>
    <tr><td><div class="title"><a href="/forum/view-thread/3000001">Patch Notes Forum Rules</a></div></td></tr>
    <tr><td><a href="/forum/view-thread/4017999">Announcement</a></td></tr>`
  const threads = pn.parseForumThreads(html)
  assert.deepEqual(threads.map(t => t.id), [4017726, 4017887, 3000001])
  const newest = pn.newestThread(threads)
  assert.deepEqual(newest, { id: 4017887, title: '3.30.0d Hotfix 2 & more' })
  assert.equal(pn.newestThread([]), undefined)
  // first check: remembered, no alert, nothing unseen
  let r = pn.afterCheck({}, newest, 1)
  assert.equal(r.notify, undefined)
  assert.equal(pn.unseen(r.state), undefined)
  assert.equal(pn.linkUrl(r.state), 'https://www.pathofexile.com/forum/view-thread/4017887')
  // same thread again: no alert
  r = pn.afterCheck(r.state, newest, 2)
  assert.equal(r.notify, undefined)
  // newer thread: one alert, unseen until opened
  const next = { id: 4018000, title: '3.30.0e Patch Notes' }
  r = pn.afterCheck(r.state, next, 3)
  assert.deepEqual(r.notify, next)
  assert.deepEqual(pn.unseen(r.state), next)
  assert.equal(pn.afterCheck(r.state, next, 4).notify, undefined)
  const seen = pn.markSeen(r.state)
  assert.equal(pn.unseen(seen), undefined)
  // page couldn't be read (Cloudflare, offline): state kept
  assert.deepEqual(pn.afterCheck(seen, undefined, 5).state.known, next)
  // no state yet: link goes to the forum
  assert.equal(pn.linkUrl({}), pn.PATCH_NOTES_FORUM)
  // stored state is checked
  assert.deepEqual(pn.loadState('{"known":{"id":"x","title":1},"seenId":2.5}'), { known: undefined, seenId: undefined, checkedAt: undefined })
  assert.deepEqual(pn.loadState('not json'), {})
  assert.equal(pn.loadState(JSON.stringify(r.state)).known.id, 4018000)
})

// F4a: poe.ninja price list kept in main for a few minutes, shared by all windows
const pc = await import('./.build/proxy-cache.mjs')

test('proxy cache: only poe.ninja dense overview GETs are cached', () => {
  const ok = pc.isCacheableProxyRequest
  const url = 'poe.ninja/poe1/api/economy/current/dense/overviews?league=Keepers&language=en'
  assert.equal(ok('GET', url), true)
  assert.equal(ok('GET', 'poe.ninja/api/economy/current/dense/overviews?league=Keepers'), true)
  assert.equal(ok('POST', url), false)
  assert.equal(ok(undefined, url), false)
  assert.equal(ok('GET', 'www.pathofexile.com/api/trade/data/stats'), false)
  assert.equal(ok('GET', 'www.poeprices.info/api?l=Keepers'), false)
  assert.equal(ok('GET', 'poe.ninja/poe1/api/economy/current/dense/overviews/../x'), false)
  assert.equal(ok('GET', 'poe.ninja/poe1/api/economy/stash/current/item/overview?league=Keepers'), false)
  assert.equal(ok('GET', 'poe.ninja.evil.com/poe1/api/economy/current/dense/overviews'), false)
  assert.equal(ok('GET', 'poe.ninja:8443/poe1/api/economy/current/dense/overviews'), false)
  assert.equal(ok('GET', 'x@poe.ninja/poe1/api/economy/current/dense/overviews'), false)
})

test('proxy cache: keeps 200s for the TTL, bounded size, shares one download', async () => {
  let t = 0
  const cache = new pc.ResponseCache(1000, 2, () => t)
  const ok = (body) => ({ statusCode: 200, statusMessage: 'OK', headers: {}, body: new TextEncoder().encode(body) })
  let loads = 0
  const load = (body) => () => { loads++; return new Promise(resolve => setTimeout(() => resolve(ok(body)), 5)) }

  // two windows asking at the same time: one download
  const [a, b] = await Promise.all([cache.fetch('A', load('a1')), cache.fetch('A', load('a2'))])
  assert.equal(loads, 1)
  assert.equal(a, b)
  // within the TTL: kept copy
  t = 999
  assert.equal(await cache.fetch('A', load('a3')), a)
  assert.equal(loads, 1)
  // after the TTL: downloaded again
  t = 1000
  const a4 = await cache.fetch('A', load('a4'))
  assert.equal(loads, 2)
  assert.equal(new TextDecoder().decode(a4.body), 'a4')

  // errors are passed on but not kept
  const err = { statusCode: 429, statusMessage: 'Too Many Requests', headers: {}, body: new Uint8Array() }
  assert.equal((await cache.fetch('E', async () => err)).statusCode, 429)
  assert.equal(cache.get('E'), undefined)
  await assert.rejects(cache.fetch('F', async () => { throw new Error('net') }))
  assert.equal((await cache.fetch('F', async () => ok('f'))).statusCode, 200)

  // bounded: the oldest goes first
  cache.set('G', ok('g'))
  assert.equal(cache.size, 2)
  assert.equal(cache.get('A'), undefined)
  assert.ok(cache.get('F'))
  assert.ok(cache.get('G'))
})

test('proxy cache: a failed download frees the slot, huge bodies and expired entries are not kept', async () => {
  let t = 0
  const cache = new pc.ResponseCache(1000, 8, () => t)
  const ok = (n) => ({ statusCode: 200, statusMessage: 'OK', headers: {}, body: new Uint8Array(n) })

  // a download that fails (timeout / aborted) while another window waits on it
  let fail
  const first = cache.fetch('A', () => new Promise((resolve, reject) => { fail = reject }))
  const joined = cache.fetch('A', async () => ok(1))
  fail(new Error('timed out'))
  await assert.rejects(first)
  await assert.rejects(joined)
  // the next request starts a new download instead of joining the dead one
  let loads = 0
  await cache.fetch('A', async () => { loads++; return ok(1) })
  assert.equal(loads, 1)

  // bodies over the limit are passed on but not kept
  const big = ok(pc.NINJA_CACHE_MAX_BODY_BYTES + 1)
  assert.equal(await cache.fetch('B', async () => big), big)
  assert.equal(cache.get('B'), undefined)

  // set() drops expired entries
  t = 1000
  cache.set('C', ok(1))
  assert.equal(cache.size, 1)
})

test('quest gems: data loads on demand (once), then plans picks and vendor buys for the class', async () => {
  const qg = await import('./.build/quest-gems.mjs')
  const p1 = qg.loadQuestGemData()
  assert.equal(qg.loadQuestGemData(), p1)
  const data = await p1
  assert.ok(data.classes.includes('Witch') && data.quests.length > 10)

  const fake = {
    classes: ['Marauder', 'Witch'],
    start: { Witch: ['Fireball'] },
    quests: [
      { quest: 'Q1', id: 'a1q1', act: 1, npc: 'T', take: { 'Freezing Pulse': 2, 'Ground Slam': 1 }, buy: { 'Arcane Surge Support': [2, 'Nessa'], Fireball: [0, 'Nessa'] } }
    ]
  }
  const wanted = [
    { name: 'Freezing Pulse', reqLevel: 1, support: false },
    { name: 'Arcane Surge', reqLevel: 1, support: true },
    { name: 'Fireball', reqLevel: 1, support: false },
    { name: 'Spark', reqLevel: 1, support: false }
  ]
  const plan = qg.planQuestGems(fake, 'Witch', wanted)
  assert.equal(plan.steps[0].take.name, 'Freezing Pulse')
  // "X Support" in the data = "X" in PoB; the start gem is not bought again
  assert.deepEqual(plan.steps[0].buy.map(g => g.name), ['Arcane Surge'])
  assert.deepEqual(plan.notFromQuests.map(g => g.name), ['Spark'])
  assert.equal(qg.planQuestGems(fake, 'Ranger', wanted), null)
})

test('thread planner: guaranteed mods, 3/6/8 bonus, cost, sheet lines', async () => {
  const th = await import('./.build/cheat-threads.mjs')
  assert.equal(th.THREADS.length, 10)
  assert.deepEqual([0, 1, 3, 4, 7, 8].map(th.guaranteedMods), [0, 1, 1, 2, 2, 3])
  const breach = th.THREADS.find(t => t.id === 'breach')
  let b = th.bonusState(breach, 2)
  assert.equal(b.active, null)
  assert.deepEqual(b.next, { at: 3, text: '20% more magic monsters', more: 1 })
  b = th.bonusState(breach, 6)
  assert.equal(b.active.at, 6)
  assert.equal(b.next.at, 8)
  b = th.bonusState(breach, 8)
  assert.equal(b.active.text, '60% more magic monsters')
  assert.equal(b.next, null)
  assert.deepEqual(th.threadCost(4, 5, 200), { chaos: 20, div: 0.1 })
  assert.deepEqual(th.threadCost(4, 5, undefined), { chaos: 20, div: null })
  assert.equal(th.threadCost(4, null, 200), null)
  assert.match(th.gateNote(breach, 1), /73\+.*Needs 2\+/)
  assert.equal(th.gateNote(th.THREADS.find(t => t.id === 'legion'), 4), null)
  // the cheat sheet takes its Thread lines from the same data
  const sec = sheets.SHEETS.find(s => s.id === 'leagues').sections.find(x => /Threads of Creation/.test(x.title))
  for (const l of Object.values(th.THREAD_SHEET_LINES)) assert.ok(sec.lines.includes(l))
  for (const t of th.THREADS) assert.ok(th.THREAD_SHEET_LINES.bonuses.includes(t.summary))
})

test('thread planner: atlas notables per Thread kind (reuses the generator rules)', async () => {
  const th = await import('./.build/cheat-threads.mjs')
  const { threadNotables, CONTENTS } = await import('./.build/atlas-generator.mjs')
  for (const t of th.THREADS) assert.ok(CONTENTS.some(c => c.id === t.atlas), `${t.id} → ${t.atlas}`)
  const ab = threadNotables('abyss')
  assert.deepEqual(ab.find(n => n.name === 'Sinistral Threads'), { name: 'Sinistral Threads', kind: 'type', how: 'set to Abyss' })
  assert.ok(!ab.some(n => n.name === 'Dextral Threads'), 'Dextral has no Abyss option')
  assert.match(ab.find(n => n.name === 'Unthreaded').how, /rule out one of .*Legion/)
  assert.ok(!ab.find(n => n.name === 'Unthreaded').how.includes('Abyss'))
  assert.ok(!ab.some(n => n.name === 'Multiplying Modifiers'), '"per different Thread" works against stacking')
  // Bestiary / Betrayal Threads match the Beasts / Syndicate content
  assert.equal(threadNotables('beasts')[0].how, 'set to Bestiary')
  assert.equal(threadNotables('syndicate')[0].how, 'set to Betrayal')
  assert.equal(threadNotables('ultimatum')[0].name, 'Dextral Threads')
  assert.deepEqual(threadNotables('nope'), [])
})

test('thread planner: review fixes (gate wording, unstated steps, general notables, tree unchanged)', async () => {
  const th = await import('./.build/cheat-threads.mjs')
  const gen = await import('./.build/atlas-generator.mjs')
  // area-gate line: original sheet wording and order, last item joined with "and"
  assert.equal(th.THREAD_SHEET_LINES.gates, 'The strongest Thread effects need 2+ Threads and a high area level (3.30.0b): area 73+ for the Blight Pantheon god, Double Down Ultimatum and the extra Breach mod; area 80+ for the extra Abyss mod, wisp beasts, Catarina joining Betrayal and rare Syndicate members.')
  assert.equal(th.joinAnd(['a']), 'a')
  assert.equal(th.joinAnd(['a', 'b', 'c']), 'a, b and c')
  assert.equal(th.joinAnd(['a', 'c and d']), 'a, c and d')
  // Ultimatum: 8 has the same text as 6, so no "Next at 8" and 8 is marked unstated
  const ult = th.THREADS.find(t => t.id === 'ultimatum')
  assert.equal(th.bonusState(ult, 6).next, null)
  assert.equal(th.bonusState(ult, 6).active.unstated, false)
  assert.equal(th.bonusState(ult, 8).active.unstated, true)
  assert.equal(th.bonusState(ult, 4).next.at, 6)
  assert.equal(th.bonusState(th.THREADS.find(t => t.id === 'breach'), 8).active.unstated, false)
  // a "general" notable naming another kind of Thread is not shown for every kind
  assert.ok(gen.namesOtherThread('Breach Threads drop more often', /Abyss/i))
  assert.ok(!gen.namesOtherThread('Abyss Threads drop more often', /Abyss/i))
  assert.ok(!gen.namesOtherThread('Map Device has 20% chance not to consume Threads', /Abyss/i))
  assert.equal(gen.threadNotables('abyss').filter(x => x.kind === 'general').length, 4, 'Thread drop / keep notables still listed')
  for (const c of gen.CONTENTS) {
    for (const n of gen.threadNotables(c.id).filter(x => x.kind === 'general')) {
      assert.ok(!/Abyss|Bestiary|Betrayal|Blight|Breach|Expedition|Incursion|Legion|Ritual|Ultimatum/i.test(n.how) || c.re.test(n.how), `${c.id}: ${n.name}`)
    }
  }
  // #294: the generator itself now matches Bestiary / Betrayal Threads for Beasts / Syndicate
  assert.ok(gen.CONTENTS.find(c => c.id === 'beasts').re.test('Bestiary'))
  assert.ok(gen.CONTENTS.find(c => c.id === 'syndicate').re.test('Betrayal'))
})

test('lazy data: loads once, a failed load is tried again (then on the next ask)', async () => {
  const { lazyOnce } = await import('./.build/lazy-data.mjs')
  let calls = 0
  const ok = lazyOnce(async () => { calls++; return 'data' }, 1, 1)
  assert.equal(ok(), ok())
  assert.equal(await ok(), 'data')
  assert.equal(calls, 1)
  // fails once, the retry works
  let tries = 0
  const flaky = lazyOnce(async () => { if (++tries === 1) throw new Error('chunk'); return 'x' }, 1, 1)
  assert.equal(await flaky(), 'x')
  assert.equal(tries, 2)
  // fails every time: rejected, and the next ask starts over
  let n = 0
  const bad = lazyOnce(async () => { n++; throw new Error('gone') }, 1, 1)
  await assert.rejects(bad(), /gone/)
  assert.equal(n, 2)
  await assert.rejects(bad(), /gone/)
  assert.equal(n, 4)
})

test('lazy data: the level recorder waits for the route, batches stay in order', async () => {
  const { afterReady } = await import('./.build/lazy-data.mjs')
  let open
  const ready = new Promise(resolve => { open = resolve })
  const seen = []
  const record = afterReady(ready, x => { seen.push(x) })
  record('a'); record('b')
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(seen, [])
  open()
  record('c')
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(seen, ['a', 'b', 'c'])
  // a route that failed to load still lets the lines through; an error in one batch doesn't stop the next
  const seen2 = []
  const errors = []
  const rec2 = afterReady(Promise.reject(new Error('no route')), x => { if (x === 1) throw new Error('bad'); seen2.push(x) }, e => errors.push(e.message))
  rec2(1); rec2(2)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.deepEqual(seen2, [2])
  assert.deepEqual(errors, ['bad'])
})

test('challenge tracker: ticks per league, SC/HC/SSF share, toggling, counts, filters', async () => {
  const ch = await import('./.build/cheat-challenges.mjs')
  const K = ch.CHALLENGE_TICKS_KEY
  localStorage.removeItem(K)
  assert.equal(K, 'deathloom.cheats.challenges.v1')
  // league keying
  assert.equal(ch.challengeLeagueKey('Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('Hardcore Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('SSF Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('HC SSF Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('Ruthless Covens'), 'Ruthless Covens')
  assert.equal(ch.challengeLeagueKey('HC Ruthless Covens'), 'Ruthless Covens')
  assert.equal(ch.challengeLeagueKey('Standard'), 'Standard')
  assert.equal(ch.challengeLeagueKey('  '), '')
  assert.equal(ch.challengeLeagueKey(undefined), '')
  assert.equal(ch.challengeLeagueKey('Ruthless'), 'Ruthless')
  assert.equal(ch.challengeLeagueKey('Hardcore Ruthless'), 'Ruthless')
  assert.equal(ch.challengeLeagueKey('Hardcore'), 'Hardcore')
  assert.equal(ch.challengeLeagueKey('SSF Hardcore Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('Hardcore SSF Covens'), 'Covens')
  assert.equal(ch.challengeLeagueKey('SSF Ruthless Covens'), 'Ruthless Covens')
  // no league (list not loaded / failed): fall back to the saved setting, else no ticking
  assert.equal(ch.challengeLeague(undefined, 'Covens'), 'Covens')
  assert.equal(ch.challengeLeague('Hardcore Covens', 'Covens'), 'Hardcore Covens')
  assert.equal(ch.challengeLeague(undefined, undefined), '')
  assert.equal(ch.challengeLeague(' ', ''), '')
  assert.equal(ch.canTickChallenges(''), false)
  assert.equal(ch.canTickChallenges('Covens'), true)
  ch.saveChallengeTicks('', new Set(['lost']))
  assert.equal(localStorage.getItem(K), null, 'nothing saved without a league')
  assert.equal(ch.loadChallengeTicks('').size, 0)
  // toggling is pure
  const a = new Set(['x'])
  const b = ch.toggleTick(a, 'y')
  assert.deepEqual([...a], ['x'])
  assert.deepEqual([...b].sort(), ['x', 'y'])
  assert.deepEqual([...ch.toggleTick(b, 'x')], ['y'])
  // save / load per league; a new league starts empty; HC sees the SC ticks
  const [c1, c2, c3] = ch.CHALLENGES
  assert.equal(ch.loadChallengeTicks('Covens').size, 0)
  ch.saveChallengeTicks('Covens', new Set([c1.id, ch.stepId(c2, 0)]))
  assert.deepEqual([...ch.loadChallengeTicks('Hardcore Covens')].sort(), [c1.id, ch.stepId(c2, 0)].sort())
  assert.equal(ch.loadChallengeTicks('NextLeague').size, 0)
  assert.equal(ch.loadChallengeTicks('Ruthless Covens').size, 0)
  ch.saveChallengeTicks('NextLeague', new Set([c3.id]))
  assert.equal(ch.loadChallengeTicks('Covens').size, 2, 'saving another league keeps this one')
  ch.saveChallengeTicks('Covens', new Set())
  assert.equal(ch.loadChallengeTicks('Covens').size, 0)
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(K))), ['NextLeague'], 'empty league dropped')
  // counts and filters
  const t = new Set([c1.id, c3.id, ch.stepId(c2, 0), ch.stepId(c2, 1)])
  assert.equal(ch.doneCount(t), 2)
  assert.equal(ch.stepsDone(t, c2), 2)
  assert.equal(ch.filterChallenges(t, 'done').length, 2)
  assert.equal(ch.filterChallenges(t, 'todo').length, ch.CHALLENGES.length - 2)
  assert.equal(ch.filterChallenges(t, 'all').length, ch.CHALLENGES.length)
  assert.ok(!ch.filterChallenges(t, 'todo').some(c => c.id === c1.id))
  assert.equal(ch.stepsNeeded(ch.CHALLENGES.find(c => c.id === 'atlas-additions')), 5)
  assert.equal(ch.stepsNeeded(ch.CHALLENGES.find(c => c.id === 'beginners-basics')), 4)
  assert.equal(ch.stepsNeeded(ch.CHALLENGES.find(c => c.id === 'tangled-threads')), 0)
  // broken or odd storage: empty, no throw, no prototype tricks
  localStorage.setItem(K, 'not json')
  assert.equal(ch.loadChallengeTicks('Covens').size, 0)
  localStorage.setItem(K, JSON.stringify({ Covens: [1, 2] }))
  assert.equal(ch.loadChallengeTicks('Covens').size, 0)
  localStorage.setItem(K, '[]')
  ch.saveChallengeTicks('Covens', new Set(['b']))
  assert.deepEqual([...ch.loadChallengeTicks('Covens')], ['b'])
  assert.equal(ch.loadChallengeTicks('constructor').size, 0)
  assert.equal(ch.loadChallengeTicks('toString').size, 0)
  localStorage.removeItem(K)
})

test('map check: build-aware map mod warnings (Q4)', async () => {
  const r = await import('./.build/build-map-rules.mjs')
  const { readFileSync } = await import('node:fs')
  const profile = (stats, mainGems, gems = mainGems, itemMods = []) => ({ mainSkill: mainGems[0], stats, mainGems, gems, itemMods })
  // melee physical slammer: big armour, life regen, little over-cap, curses enemies
  const slam = r.buildTraits(profile(
    { Life: 5000, LifeRegenRecovery: 300, LifeLeechGainRate: 100, HitChance: 95, CombinedDPS: 1e6, TotalDPS: 1e6, Armour: 30000, PhysicalDamageReduction: 70, FireResist: 75, ColdResist: 75, LightningResist: 75, ChaosResist: -20, FireResistOverCap: 5, ColdResistOverCap: 20, LightningResistOverCap: 12, PhysicalMaximumHitTaken: 20000, FireMaximumHitTaken: 9000, ColdMaximumHitTaken: 9000, LightningMaximumHitTaken: 9000, ChaosMaximumHitTaken: 4000, Cooldown: 0 },
    ['Boneshatter', 'Brutality', 'Melee Physical Damage'], ['Boneshatter', 'Brutality', 'Melee Physical Damage', 'Vulnerability', 'Pride', 'Determination']))
  // self-cast crit lightning spell on energy shield, leeching, curse immune
  const arc = r.buildTraits(profile(
    { Life: 1, EnergyShield: 8000, EnergyShieldLeechGainRate: 900, CritChance: 65, CombinedDPS: 2e6, TotalDPS: 2e6, FireResist: 76, ColdResist: 76, LightningResist: 76, ChaosResist: 75, FireResistOverCap: 40, ColdResistOverCap: 45, LightningResistOverCap: 50, ChaosResistOverCap: 0 },
    ['Arc', 'Spell Echo', 'Lightning Penetration'], ['Arc', 'Spell Echo', 'Lightning Penetration', 'Zealotry', 'Discipline', 'Wave of Conviction'], ['Immune to Curses', 'Inflict Lightning Exposure on Hit']))
  // minions (summoner), regen-free, nothing else
  const minion = r.buildTraits(profile(
    { Life: 4500, ActiveMinionLimit: 20, CombinedDPS: 5e5, FireResist: 75, ColdResist: 75, LightningResist: 75, ChaosResist: 10 },
    ['Raise Spectre', 'Minion Damage'], ['Raise Spectre', 'Minion Damage', 'Flesh Offering']))
  // ignite caster with totems
  const ignite = r.buildTraits(profile(
    { Life: 4000, CombinedDPS: 1e6, TotalDPS: 2e5, IgniteDPS: 8e5, TotemPlacementTime: 0.5, FireResist: 75, ColdResist: 60, LightningResist: 75, FireResistOverCap: 30, ColdResistOverCap: 0, LightningResistOverCap: 30 },
    ['Fireball', 'Spell Totem', 'Burning Damage']))

  const allRefs = new Map(readFileSync(new URL('../renderer/public/data/en/stats.ndjson', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l)).map(s => [s.ref, s]))
  const refsOk = (ref) => Boolean(allRefs.get(ref)?.fromAreaMods)
  const check = (t, ref, value) => r.checkMapMod(ref, value, t)
  const danger = (t, ref, value) => check(t, ref, value)?.danger

  // traits
  assert.equal(slam.melee, true); assert.equal(slam.physical, true); assert.equal(slam.regen, true); assert.equal(slam.armour, true)
  assert.equal(arc.spell, true); assert.equal(arc.crit, true); assert.equal(arc.leech, true); assert.equal(arc.curseImmune, true); assert.equal(arc.melee, false)
  assert.equal(minion.minion, true); assert.equal(minion.attack, false)
  assert.equal(ignite.delivered, true); assert.ok(ignite.igniteShare > 0.7)

  // thorns / melee reflect: only the melee build
  for (const ref of ['Rare Monsters have Physical Thorns reflecting # Physical Damage', 'Rare Monsters have Elemental Thorns reflecting # Elemental Damage', '#% of Melee Physical Damage taken reflected to Attacker']) {
    assert.equal(danger(slam, ref), true, ref)
    assert.equal(danger(arc, ref), false, ref)
    assert.equal(danger(minion, ref), false, ref)
    assert.equal(danger(ignite, ref), false, ref)
  }
  // regen / leech / recovery (value relative to "more Recovery Rate": 40% less = -40)
  assert.equal(danger(slam, 'Players cannot Regenerate Life, Mana or Energy Shield'), true)
  assert.equal(danger(arc, 'Players cannot Regenerate Life, Mana or Energy Shield'), false)
  assert.equal(danger(arc, 'Monsters cannot be Leeched from'), true)
  assert.equal(danger(minion, 'Monsters cannot be Leeched from'), false)
  assert.equal(danger(arc, 'Players have #% less Recovery Rate of Life and Energy Shield', -40), true)
  assert.equal(danger(minion, 'Players have #% less Recovery Rate of Life and Energy Shield', -40), false)
  assert.equal(danger(arc, 'Players have #% increased Maximum total Life, Mana and Energy Shield Recovery per second from Leech', -60), true)
  // max res vs over-cap
  assert.equal(danger(slam, 'Players have #% to all maximum Resistances', -10), true)
  assert.match(check(slam, 'Players have #% to all maximum Resistances', -10).reason, /5%/)
  assert.equal(danger(arc, 'Players have #% to all maximum Resistances', -10), false)
  assert.equal(danger(minion, 'Players have #% to all maximum Resistances', -10), true, 'no over-cap saved: may drop below cap')
  // curses vs curse immunity, Elemental Weakness vs over-cap, Vulnerability vs weakest hit
  assert.equal(danger(arc, 'Players are Cursed with Temporal Chains'), false)
  assert.equal(danger(slam, 'Players are Cursed with Temporal Chains'), true)
  assert.equal(danger(slam, 'Players are Cursed with Elemental Weakness'), true)
  assert.equal(danger(ignite, 'Players are Cursed with Elemental Weakness'), true, 'cold over-cap 0')
  assert.equal(danger(slam, 'Players are Cursed with Vulnerability'), false, 'chaos is the weakest hit')
  // hexproof vs curse users; ailment avoidance vs ailment builds
  assert.equal(danger(slam, 'Monsters are Hexproof'), true)
  assert.equal(danger(arc, 'Monsters are Hexproof'), false)
  assert.equal(danger(ignite, 'Monsters have #% chance to Avoid Elemental Ailments'), true)
  assert.equal(danger(arc, 'Monsters have #% chance to Avoid Elemental Ailments'), false)
  assert.equal(danger(ignite, 'Monsters have a #% chance to avoid Poison, Impale, and Bleeding'), false)
  // hit-side mods
  assert.equal(danger(arc, 'Monsters take #% reduced Extra Damage from Critical Strikes', 30), true)
  assert.equal(danger(slam, 'Monsters take #% reduced Extra Damage from Critical Strikes', 30), false)
  assert.equal(danger(slam, 'Players have #% more Accuracy Rating', -25), true)
  assert.equal(danger(slam, 'Players have #% more Accuracy Rating', 25), false)
  assert.equal(danger(arc, 'Players have #% more Accuracy Rating', -25), false)
  assert.equal(danger(arc, 'Monsters have +#% chance to Suppress Spell Damage'), true)
  assert.equal(danger(slam, 'Monsters have +#% chance to Suppress Spell Damage'), false)
  assert.equal(danger(arc, '+#% Monster Elemental Resistances'), true)
  assert.equal(danger(slam, '+#% Monster Elemental Resistances'), false)
  assert.equal(danger(slam, '+#% Monster Physical Damage Reduction'), true)
  assert.equal(danger(minion, '+#% Monster Physical Damage Reduction'), false)
  // defences, auras, exposure, extra damage vs res (20% less armour = -20)
  assert.equal(danger(slam, 'Players have #% less Armour', -40), true)
  assert.equal(danger(arc, 'Players have #% less Armour', -40), false)
  assert.equal(danger(arc, 'Players have #% increased effect of Non-Curse Auras from Skills', -60), true)
  assert.equal(danger(arc, 'Players cannot inflict Exposure'), true)
  assert.equal(danger(slam, 'Players cannot inflict Exposure'), false)
  assert.equal(danger(slam, 'Monsters gain #% of their Physical Damage as Extra Chaos Damage'), true)
  assert.equal(danger(arc, 'Monsters gain #% of their Physical Damage as Extra Chaos Damage'), false)
  assert.equal(danger(ignite, 'Monsters deal #% extra Physical Damage as Cold'), true)
  assert.equal(danger(ignite, 'Monsters deal #% extra Physical Damage as Fire'), false)
  // mods the rules don't know: null (greyed, "no build-specific rule")
  assert.equal(check(slam, '#% increased Pack size', 20), null)
  // penetration vs uncapped res / elemental weakest hit; poison on hit vs chaos res
  const pen = 'Monster Damage Penetrates #% Elemental Resistances'
  assert.equal(danger(ignite, pen, 10), true, 'cold uncapped')
  assert.equal(danger(slam, pen, 10), false, 'capped, chaos is the weakest hit')
  assert.equal(check(slam, pen, 10).general, true, 'still never greyed')
  assert.equal(danger(slam, 'Monsters Poison on Hit'), true, 'chaos res -20')
  assert.equal(danger(arc, 'Monsters Poison on Hit'), false)
  assert.equal(check(arc, 'Monsters Poison on Hit').general, true)
  // dangerous for every build: never greyed (general), only in the harmful direction
  for (const [ref, v] of [['+#% to Monster Critical Strike Multiplier', 40], ['#% increased Monster Damage', 20], ['All Monster Damage from Hits always Ignites', undefined],
    ['Buffs on Players expire #% faster', 50], ['Players gain #% reduced Flask Charges', -40], ['Unique Boss deals #% increased Damage', 25]]) {
    for (const t of [slam, arc, minion, ignite]) {
      const f = check(t, ref, v)
      assert.ok(f && !f.danger && f.general, ref)
      assert.match(f.reason, /every build/)
    }
    assert.ok(r.ALWAYS_DANGEROUS[ref], ref)
  }
  assert.equal(check(slam, 'Players gain #% reduced Flask Charges', 20), null, 'more flask charges: not general')
  assert.equal(check(slam, 'Buffs on Players expire #% faster', -30), null, 'buffs slower: not general')
  for (const ref of Object.keys(r.ALWAYS_DANGEROUS)) {
    assert.ok(refsOk(ref), `map mod stat missing: ${ref}`)
  }
  assert.match(r.describeTraits(slam), /melee/)

  // every rule names a real map mod stat (an upstream data refresh can't silently break them)
  const refs = new Map(readFileSync(new URL('../renderer/public/data/en/stats.ndjson', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l)).map(s => [s.ref, s]))
  for (const ref of Object.keys(r.MAP_MOD_RULES)) {
    assert.ok(refs.get(ref)?.fromAreaMods, `map mod stat missing: ${ref}`)
  }
})

test('build files: real path must stay inside the player folder (Q4 review)', async () => {
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'q4-'))
  try {
    const root = path.join(base, 'player')
    await fs.mkdir(path.join(root, 'sub'), { recursive: true })
    await fs.writeFile(path.join(root, 'sub', 'a.xml'), 'x')
    await fs.writeFile(path.join(base, 'outside.xml'), 'x')
    assert.equal(await buildFiles.realFileInside(root, 'sub/a.xml'), await fs.realpath(path.join(root, 'sub', 'a.xml')))
    assert.equal(await buildFiles.realFileInside(root, '../outside.xml'), null)
    let linked = true
    try { await fs.symlink(path.join(base, 'outside.xml'), path.join(root, 'link.xml')) } catch { linked = false }
    if (linked) assert.equal(await buildFiles.realFileInside(root, 'link.xml'), null, 'a link out of the folder is refused')
    await assert.rejects(buildFiles.realFileInside(root, 'missing.xml'))
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

test('build file: profile for the map check (Q4)', () => {
  const sum = {
    mainSkill: 'Boneshatter',
    stats: { Life: 5000, FireResistOverCap: 10, 'bad key': 3, NaNStat: NaN },
    groups: [
      { enabled: true, gems: [{ name: 'Pride', enabled: true }] },
      { enabled: true, gems: [{ name: 'Boneshatter', enabled: true }, { name: 'Brutality', enabled: true }, { name: 'Ruthless', enabled: false }] },
      { enabled: false, gems: [{ name: 'Vulnerability', enabled: true }] }
    ],
    items: [{ slot: 'Ring 1', rarity: 'Rare', name: 'x', base: 'y', mods: ['+30 to maximum Life', 'Immune to Curses'] }],
    tree: { nodes: [], masteries: {} }
  }
  const p = buildXml.buildMapProfile(sum)
  assert.deepEqual(p.stats, { Life: 5000, FireResistOverCap: 10 })
  assert.deepEqual(p.mainGems, ['Boneshatter', 'Brutality'])
  assert.deepEqual(p.gems, ['Pride', 'Boneshatter', 'Brutality'])
  assert.deepEqual(p.itemMods, ['Immune to Curses'])
})

test('fate value: outcomes at poe.ninja prices, best marked, unknowns honest (Q5)', async () => {
  const f = await import('./.build/cheat-fates.mjs')
  const ch = await import('./.build/cheat-challenges.mjs')
  // every Promised Profits reward type is listed (count in brackets stripped)
  const pp = ch.CHALLENGES.find(c => c.id === 'promised-profits')
  const labels = new Set(f.FATE_OUTCOMES.map(o => o.label))
  for (const s of pp.steps) assert.ok(labels.has(s.replace(/ \(\d+\)$/, '')), s)
  // ids unique; only GGG-stated single outcomes say 'single' and need 2 copies
  assert.equal(new Set(f.FATE_OUTCOMES.map(o => o.id)).size, f.FATE_OUTCOMES.length)
  assert.deepEqual(f.FATE_OUTCOMES.filter(o => o.qty === 'single').map(o => o.id), ['divine', 'annul'])
  assert.deepEqual(f.FATE_OUTCOMES.filter(o => o.copies === 2).map(o => o.id), ['divine', 'annul'])
  assert.equal(f.THREAD_ITEMS.length, 10)

  const prices = { 'Divine Orb': 200, 'Orb of Annulment': 30, 'Stacked Deck': 4, 'Abyss Thread': 10, 'Legion Thread': 50, 'Hide of the Vendigo': 500 }
  const rows = f.valueFates(f.FATE_OUTCOMES, r => prices[r.name] ?? null)
  assert.equal(rows[0].outcome.id, 'vendigo')
  assert.ok(rows[0].best)
  assert.equal(rows.filter(r => r.best).length, 1)
  assert.deepEqual(rows.slice(1, 5).map(r => r.outcome.id), ['divine', 'annul', 'threads', 'stacked-decks'])
  const th = rows.find(r => r.outcome.id === 'threads')
  assert.equal(th.low, 10); assert.equal(th.high, 50)
  // unpriced named items before random drops; random drops last and never best
  const dm = rows.findIndex(r => r.outcome.id === 'dreadmaidens')
  const cur = rows.findIndex(r => r.outcome.id === 'currency')
  assert.ok(dm < cur && rows[dm].low === null && !rows[dm].varies && rows[cur].varies)
  // ITEM tried before UNIQUE; bad numbers ignored
  const r2 = f.valueFates(f.FATE_OUTCOMES, r => r.name === 'Corpse Rose' ? (r.ns === 'UNIQUE' ? 7 : NaN) : -1)
  assert.equal(r2[0].outcome.id, 'corpse-rose'); assert.equal(r2[0].low, 7)
  // no prices at all: nothing best
  assert.ok(f.valueFates(f.FATE_OUTCOMES, () => null).every(r => !r.best))
  assert.ok(f.valueFates(f.FATE_OUTCOMES, () => 0).every(r => !r.best))
})

// Deathloom fork (Q6): price alerts to the phone
const alerts = await import('./.build/price-alerts.mjs')

const NINJA_BLOB = '{"overviews":[' +
  '{"type":"Currency","lines":[{"name":"Divine Orb","chaos":200,"graph":[1]},{"name":"Exalted Orb","chaos":12.5,"graph":[]}]},' +
  '{"type":"UniqueAccessory","lines":[{"name":"Mageblood","chaos":30000,"graph":[]},{"name":"Headhunter","variant":"Relic","chaos":9000}]},' +
  '{"type":"SkillGem","lines":[{"name":"Exalted Orb","chaos":1}]}]}'

test('price alerts: poe.ninja lookup by section, name and variant', () => {
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'Currency', 'Exalted Orb'), 12.5)
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'SkillGem', 'Exalted Orb'), 1)
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'UniqueAccessory', 'Headhunter', 'Relic'), 9000)
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'UniqueAccessory', 'Headhunter'), null)
  // a name only in another section isn't taken
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'Currency', 'Mageblood'), null)
  assert.equal(alerts.ninjaChaos(NINJA_BLOB, 'Fossil', 'Exalted Orb'), null)
  assert.equal(alerts.ninjaDivine(NINJA_BLOB), 200)
  assert.equal(alerts.ninjaDivine('{"type":"Currency","lines":[{"name":"Divine Orb","chaos":3}]}'), null)
})

test('price alerts: league from the shared download path (PoE 1 price list only)', () => {
  assert.equal(alerts.ninjaLeague('poe.ninja/poe1/api/economy/current/dense/overviews?league=Keepers&language=en'), 'Keepers')
  assert.equal(alerts.ninjaLeague('poe.ninja/poe1/api/economy/current/dense/overviews?league=Hardcore%20Keepers&language=en'), 'Hardcore Keepers')
  assert.equal(alerts.ninjaLeague('poe.ninja/poe2/api/economy/current/dense/overviews?league=X'), null)
  assert.equal(alerts.ninjaLeague('poe.ninja.evil.com/poe1/api/economy/current/dense/overviews?league=X'), null)
  assert.equal(alerts.ninjaLeague('www.pathofexile.com/api/trade?league=X'), null)
})

test('price alerts: only checked, sane input is added', () => {
  const ok = { league: 'Keepers', type: 'UniqueAccessory', name: 'Mageblood', label: 'Mageblood', dir: 'above', value: 150, unit: 'div' }
  assert.deepEqual(alerts.validateAlertInput(ok, 0), { ...ok, variant: undefined })
  assert.equal(typeof alerts.validateAlertInput({ ...ok, dir: 'sideways' }, 0), 'string')
  assert.equal(typeof alerts.validateAlertInput({ ...ok, value: -1 }, 0), 'string')
  assert.equal(typeof alerts.validateAlertInput({ ...ok, value: Infinity }, 0), 'string')
  assert.equal(typeof alerts.validateAlertInput({ ...ok, type: 'Currency"},{"x' }, 0), 'string')
  assert.equal(typeof alerts.validateAlertInput({ ...ok, name: 'x'.repeat(201) }, 0), 'string')
  assert.equal(typeof alerts.validateAlertInput(ok, alerts.MAX_PRICE_ALERTS), 'string')
  assert.equal(alerts.validateAlertInput({ ...ok, label: 'Mage\nblood\u0007' }, 0).label, 'Mageblood')
  // the file is read back the same careful way
  const st = alerts.readAlertState({ rules: [{ ...ok, id: 'a1', createdAt: 1, armed: true }, { ...ok, id: '../x' }, { id: 'b' }], fired: [{ id: 1 }], pcAlways: 'yes' })
  assert.equal(st.rules.length, 1)
  assert.equal(st.rules[0].armed, true)
  assert.deepEqual(st.fired, [])
  assert.equal(st.pcAlways, false)
  assert.deepEqual(alerts.readAlertState('nonsense'), alerts.emptyAlertState())
})

test('price alerts: fire once per crossing, re-arm past 3%, at most once an hour', () => {
  const H = 60 * 60 * 1000
  let rule = { id: 'r', league: 'L', type: 'Currency', name: 'X', label: 'X', dir: 'above', value: 100, unit: 'chaos', createdAt: 0 }
  // first price only arms (already above: never fires for it)
  let s = alerts.stepRule(rule, 120, 0)
  assert.equal(s.fire, false); assert.equal(s.rule.armed, false)
  s = alerts.stepRule(rule, 90, 0)
  assert.equal(s.fire, false); assert.equal(s.rule.armed, true)
  rule = s.rule
  s = alerts.stepRule(rule, 105, 1 * H); assert.equal(s.fire, true); rule = s.rule
  // stays above: no second alert
  s = alerts.stepRule(rule, 130, 2 * H); assert.equal(s.fire, false); rule = s.rule
  // dips just under the line (within 3%): not re-armed
  s = alerts.stepRule(rule, 98, 3 * H); assert.equal(s.rule.armed, false); rule = s.rule
  s = alerts.stepRule(rule, 101, 4 * H); assert.equal(s.fire, false); rule = s.rule
  // well under: re-armed, fires on the next crossing
  s = alerts.stepRule(rule, 90, 5 * H); assert.equal(s.rule.armed, true); rule = s.rule
  s = alerts.stepRule(rule, 100, 6 * H); assert.equal(s.fire, true); rule = s.rule
  // flapping inside the hour: re-armed but the cooldown holds it back
  s = alerts.stepRule(rule, 50, 6 * H + 1000); rule = s.rule
  s = alerts.stepRule(rule, 150, 6 * H + 2000); assert.equal(s.fire, false); assert.equal(s.rule.armed, true); rule = s.rule
  s = alerts.stepRule(rule, 150, 7 * H + 1); assert.equal(s.fire, true)
  // no price: nothing changes
  assert.equal(alerts.stepRule(rule, null, 8 * H).rule, rule)
  // below works the other way round
  const below = { ...rule, dir: 'below', value: 10, armed: true, firedAt: undefined }
  assert.equal(alerts.stepRule(below, 9.9, 0).fire, true)
  assert.equal(alerts.stepRule(below, 10.1, 0).fire, false)
})

test('price alerts: a fresh price list checks only that league, divine alerts use the divine price', () => {
  const base = { league: 'Keepers', type: 'UniqueAccessory', name: 'Mageblood', label: 'Mageblood', dir: 'above', unit: 'div', createdAt: 0 }
  const state = {
    pcAlways: false,
    fired: [],
    rules: [
      { ...base, id: 'a', value: 140, armed: true },
      { ...base, id: 'b', value: 160, armed: true },
      { ...base, id: 'c', value: 1, armed: true, league: 'Standard' },
      { ...base, id: 'd', name: 'Exalted Orb', type: 'Currency', label: 'Exalted Orb', unit: 'chaos', dir: 'below', value: 13, armed: true }
    ]
  }
  const res = alerts.checkAlerts(state, NINJA_BLOB, 'Keepers', 1000)
  assert.deepEqual(res.fired.map(f => f.ruleId), ['a', 'd'])
  assert.equal(res.fired[0].price, 150)
  assert.equal(res.fired[0].chaos, 30000)
  assert.equal(alerts.alertText(res.fired[0]), 'Mageblood is above 140 div (now 150 div)')
  assert.equal(res.state.rules.find(r => r.id === 'c'), state.rules[2])
  assert.equal(res.state.fired.length, 2)
  // the same list again: nothing new
  const again = alerts.checkAlerts(res.state, NINJA_BLOB, 'Keepers', 2000)
  assert.equal(again.fired.length, 0)
  assert.equal(res.changed, true)
  // another league's list doesn't touch these
  assert.equal(alerts.checkAlerts(state, NINJA_BLOB, 'Hardcore', 1000).changed, false)
  // only the "now" price moved: not a change worth saving/broadcasting, but kept in memory
  const quiet = { ...res.state, rules: res.state.rules.map(r => ({ ...r, last: 1 })) }
  const moved = alerts.checkAlerts(quiet, NINJA_BLOB, 'Keepers', 3000)
  assert.equal(moved.changed, false)
  assert.equal(moved.lastChanged, true)
  assert.equal(moved.fired.length, 0)
  assert.equal(moved.state.rules.find(r => r.id === 'a').last, 150)
  assert.equal(moved.state.fired, quiet.fired)
  // same prices again: nothing at all
  const same = alerts.checkAlerts(moved.state, NINJA_BLOB, 'Keepers', 4000)
  assert.equal(same.changed || same.lastChanged, false)
  assert.equal(same.state, moved.state)
})

test('price alerts: no duplicates, PC notified unless a phone confirmed, file read-back cleaned', () => {
  const ok = { league: 'Keepers', type: 'UniqueAccessory', name: 'Mageblood', label: 'Mageblood', dir: 'above', value: 150, unit: 'div' }
  assert.equal(alerts.isDuplicateAlert([ok], { ...ok }), true)
  assert.equal(alerts.isDuplicateAlert([ok], { ...ok, value: 151 }), false)
  assert.equal(alerts.isDuplicateAlert([ok], { ...ok, dir: 'below' }), false)
  assert.equal(alerts.isDuplicateAlert([ok], { ...ok, variant: 'Relic' }), false)
  assert.equal(alerts.shouldNotifyPc({ pcAlways: false, phoneAcked: false }), true)
  assert.equal(alerts.shouldNotifyPc({ pcAlways: false, phoneAcked: true }), false)
  assert.equal(alerts.shouldNotifyPc({ pcAlways: true, phoneAcked: true }), true)
  assert.deepEqual(alerts.cleanAckIds(['a-1', '../x', 5, 'b_2']), ['a-1', 'b_2'])
  assert.deepEqual(alerts.cleanAckIds('a'), [])
  const fired = { id: 'r1-5', ruleId: 'r1', league: 'Keepers', label: 'Mage\nblood', dir: 'above', value: 1, unit: 'div', price: 2, chaos: 400, at: 5 }
  const st = alerts.readAlertState({
    rules: [{ ...ok, id: 'a' }, { ...ok, id: 'b' }],
    fired: [fired, { ...fired, id: '<img>' }, { ...fired, label: 'x'.repeat(300) }, { ...fired, price: Infinity }]
  })
  assert.equal(st.rules.length, 1)
  assert.equal(st.fired.length, 1)
  assert.equal(st.fired[0].label, 'Mageblood')
})

test('request guard: phones see price alerts but cannot change them, nor take over the price check', () => {
  const ok = guard.allowedFromOtherDevice
  assert.equal(ok('CLIENT->MAIN::price-alerts', { op: 'list' }), true)
  assert.equal(ok('CLIENT->MAIN::price-alerts', { op: 'ack', ids: ['a'] }), true)
  assert.equal(ok('CLIENT->MAIN::price-alerts', { op: 'add', rule: {} }), false)
  assert.equal(ok('CLIENT->MAIN::price-alerts', { op: 'remove', id: 'a' }), false)
  assert.equal(ok('CLIENT->MAIN::price-alerts', { op: 'settings', pcAlways: true }), false)
  assert.equal(ok('CLIENT->MAIN::price-alerts', null), false)
  assert.equal(ok('CLIENT->MAIN::used-recently', { isOverlay: false }), false)
  assert.equal(ok('CLIENT->MAIN::stash-session', { sessionId: 'x' }), false)
  // the PC's own windows still reach main (price check needs OVERLAY->MAIN)
  assert.equal(guard.isClientEvent('CLIENT->MAIN::price-alerts'), true)
  assert.equal(guard.isClientEvent('OVERLAY->MAIN::track-area'), true)
})

test('pace log (Q8): level times, deaths and act splits from Client.txt become a saved run', async () => {
  const cl = await import('./.build/char-level.mjs')
  const pace = await import('./.build/pace-log.mjs')
  localStorage.removeItem(pace.PACE_KEY)
  const L = (t, s) => `2026/11/14 10:${t} 123 abc [INFO Client 1] ${s}`
  const lines = [
    L('00:00', ': Hero (Witch) is now level 2'),
    '2026/11/14 10:00:05 1 a [DEBUG Client 1] Generating level 2 area "1_1_2" with seed 1',
    L('05:05', ': Hero (Witch) is now level 3'),
    L('06:00', ': Hero has been slain.'),
    L('06:30', ': Friend has been slain.'),
    '2026/11/14 10:10:05 1 a [DEBUG Client 1] Generating level 12 area "1_2_1" with seed 2',
    L('20:05', ': Hero (Witch) is now level 13'),
    '2026/11/14 10:25:05 1 a [DEBUG Client 1] Generating level 22 area "1_3_1" with seed 3'
  ]
  let v = { chars: [], selected: '', manual: null, questPoints: null, progress: {} }
  v = cl.applyLogLines(v, lines, 'en', 0)
  const p = v.progress.Hero
  assert.equal(p.firstLevel, 2)
  assert.equal(p.deaths, 1, 'only our own death counts')
  assert.equal(p.startAt, new Date(2026, 10, 14, 10, 0, 0).getTime())
  assert.deepEqual(p.levelAt, { 2: 0, 3: 300000, 13: 1200000 })
  assert.deepEqual(p.splits, { 1: 0, 2: 600000, 3: 1500000 })
  cl.saveCharLevels(v)
  const st = pace.loadPaceStore()
  assert.equal(st.runs.length, 1)
  const run = st.runs[0]
  assert.equal(run.id, `Hero@${p.startAt}`)
  assert.equal(run.cls, 'Witch')
  assert.equal(run.level, 13)
  assert.equal(run.deathsByAct[1], 1)
  // 11 levels in 20 minutes of campaign time
  assert.equal(pace.levelsPerHour(run), 33)
  assert.equal(pace.levelsPerHour({ levelAt: { 2: 0, 3: 60000 } }), null, 'too little data')
  // saving again without changes keeps the same store object
  assert.equal(pace.syncRuns(st, v), st)
})

test('pace log (Q8): compare with best / last, cap, forget, bad data', async () => {
  const pace = await import('./.build/pace-log.mjs')
  const mk = (name, startAt, splits, extra = {}) => ({ id: `${name}@${startAt}`, name, cls: '', startAt, updatedAt: startAt, splits, actMs: {}, deaths: 0, deathsByAct: {}, levelAt: {}, level: 1, campaignMs: 0, endgame: false, ...extra })
  const fast = mk('Fast', 1, { 1: 0, 2: 100, 3: 200 })
  const slow = mk('Slow', 2, { 1: 0, 2: 300, 3: 500 })
  const short = mk('Short', 3, { 1: 0, 2: 50 })
  const runs = [fast, slow, short]
  assert.equal(pace.bestRun(runs).id, fast.id, 'furthest act, then fastest')
  assert.equal(pace.bestRun(runs, fast.id).id, slow.id)
  assert.equal(pace.latestRun(runs).id, short.id)
  const cur = mk('Now', 9, { 1: 0, 2: 150 }, { deathsByAct: { 2: 3 }, levelAt: { 2: 0, 10: 140 } })
  const rows = pace.paceRows(cur, fast)
  assert.deepEqual(rows.map(r => [r.act, r.delta]), [[1, 0], [2, 50], [3, null]])
  assert.equal(rows[1].level, 10)
  assert.equal(rows[1].deaths, 3)
  // cap: newest runs, the best finished one kept
  const many = Array.from({ length: 12 }, (_, i) => mk(`C${i}`, 100 + i, { 1: 0, 2: 1000 }))
  const capped = pace.capRuns([...many, fast])
  assert.equal(capped.length, pace.MAX_RUNS)
  assert.ok(capped.some(r => r.id === fast.id))
  // forget: gone and not brought back by the next sync
  let st = pace.forgetRun({ runs: [fast, slow], forgotten: [] }, fast.id)
  assert.deepEqual(st.runs.map(r => r.id), [slow.id])
  const levels = { chars: [{ name: 'Fast', cls: 'Duelist', level: 5, at: 1 }], progress: { Fast: { firstLevel: 2, startAt: 1, splits: { 1: 0 }, passives: 0, respec: 0, quests: [], bosses: [] } } }
  assert.equal(pace.syncRuns(st, levels), st)
  // a run saved before its start was known is replaced, not duplicated
  st = { runs: [mk('Fast', 0, { 1: 0 })], forgotten: [] }
  assert.deepEqual(pace.syncRuns(st, levels).runs.map(r => r.id), ['Fast@1'])
  // characters not followed from level 2 make no run
  assert.equal(pace.runFromProgress('X', '', 50, { firstLevel: 40, splits: { 5: 1 } }, 0), null)
  // stored junk is dropped
  const bad = pace.parsePaceStore(JSON.stringify({ runs: [null, { id: 1 }, { id: 'a@1', name: 'A', splits: { 1: -5, x: 3, 2: 'y', 3: 7 } }], forgotten: [3, 'z'] }))
  assert.equal(bad.runs.length, 1)
  assert.deepEqual(bad.runs[0].splits, { 3: 7 })
  assert.deepEqual(bad.forgotten, ['z'])
  assert.deepEqual(pace.parsePaceStore('nope'), { runs: [], forgotten: [] })
  assert.equal(pace.fmtDelta(-61000), '−1:01')
  assert.equal(pace.fmtDelta(0), '±0:00')
})

test('pace log (Q8 fix): a character remade with the same name is a new run', async () => {
  const cl = await import('./.build/char-level.mjs')
  const pace = await import('./.build/pace-log.mjs')
  const L = (d, t, s) => `2026/11/${d} 10:${t} 1 a [INFO Client 1] ${s}`
  const A = (d, t, code) => `2026/11/${d} 10:${t} 1 a [DEBUG Client 1] Generating level 2 area "${code}" with seed 1`
  const league1 = [L('01', '00:00', ': Hero (Witch) is now level 2'), A('01', '00:05', '1_1_2'), A('01', '30:05', '1_2_1'),
    L('01', '40:00', ': Hero (Witch) is now level 20'), A('01', '45:05', '1_3_1')]
  const league2 = [L('20', '00:00', ': Hero (Ranger) is now level 2'), A('20', '00:05', '1_1_2'), A('20', '05:05', '1_2_1')]
  let v = { chars: [], selected: '', manual: null, questPoints: null, progress: {} }
  v = cl.applyLogLines(v, league1, 'en', 0)
  const first = { ...v.progress.Hero }
  let st = pace.syncRuns({ runs: [], forgotten: [] }, v)
  v = cl.applyLogLines(v, league2, 'en', 0)
  const p = v.progress.Hero
  assert.notEqual(p.startAt, first.startAt)
  assert.deepEqual(p.levelAt, { 2: 0 })
  assert.deepEqual(p.splits, { 1: 0, 2: 300000 })
  st = pace.syncRuns(st, v)
  assert.equal(st.runs.length, 2, 'the old run is kept, the new one added')
  assert.equal(pace.bestRun(st.runs, pace.runId('Hero', p)).id, pace.runId('Hero', first))
  // Rebuild over both leagues gives the same two runs
  const rebuilt = cl.rebuildFromLog({ chars: [], selected: '', manual: null, questPoints: null, progress: {} }, [...league1, ...league2], 'en')
  assert.equal(rebuilt.progress.Hero.startAt, p.startAt)
  // a duplicate level line doesn't reset
  const again = cl.applyLogLines(v, [L('20', '06:00', ': Hero (Ranger) is now level 2')], 'en', 0)
  assert.deepEqual(again.progress.Hero.splits, p.splits)
})

test('pace log (Q8 fix): name-only match keeps a different earlier run; line without a time', async () => {
  const cl = await import('./.build/char-level.mjs')
  const pace = await import('./.build/pace-log.mjs')
  const old = { id: 'Hero@0', name: 'Hero', cls: '', startAt: 0, updatedAt: 1, splits: { 1: 0, 2: 999 }, actMs: {}, deaths: 0, deathsByAct: {}, levelAt: {}, level: 30, campaignMs: 0, endgame: false }
  const levels = { chars: [{ name: 'Hero', cls: 'Witch', level: 3, at: 1 }], progress: { Hero: { firstLevel: 2, startAt: 5, splits: { 1: 0, 2: 100 }, passives: 0, respec: 0, quests: [], bosses: [] } } }
  const st = pace.syncRuns({ runs: [old], forgotten: [] }, levels)
  assert.deepEqual(st.runs.map(r => r.id).sort(), ['Hero@0', 'Hero@5'])
  // no timestamp on the line: "now" is used for the start
  const v = cl.applyLogLines({ chars: [], selected: '', manual: null, questPoints: null, progress: {} }, ['[INFO Client 1] : Solo (Witch) is now level 2'], 'en', 0, undefined, 12345)
  assert.equal(v.progress.Solo.startAt, 12345)
  assert.deepEqual(v.progress.Solo.levelAt, { 2: 0 })
})

test('request guard (Q8): a phone cannot take the game log catch-up lines', () => {
  assert.equal(guard.allowedFromOtherDevice('CLIENT->MAIN::game-log-catchup', {}), false)
  assert.equal(guard.allowedFromOtherDevice('CLIENT->MAIN::read-game-log', { requestId: 1 }), true)
})

// Deathloom fork (Q10): loot filter add-on
const lootFilter = await import('./.build/loot-filter.mjs')
const lootFiles = await import('./.build/loot-filter-files.mjs')

test('loot filter: names that can go in quotes, file names, add-on name', () => {
  const lf = lootFilter
  assert.equal(lf.isSafeItemName("Kaom's Heart"), true)
  assert.equal(lf.isSafeItemName('Maelström Staff'), true)
  assert.equal(lf.isSafeItemName('Two-Toned Boots'), true)
  assert.equal(lf.isSafeItemName('Bad"Name'), false)
  assert.equal(lf.isSafeItemName('Line\nBreak'), false)
  assert.equal(lf.isSafeItemName('# comment'), false)
  assert.equal(lf.isSafeItemName('x'), false)
  assert.equal(lf.isSafeItemName(5), false)
  assert.equal(lf.isFilterFileName('NeverSink Strict.filter'), true)
  assert.equal(lf.isFilterFileName('../evil.filter'), false)
  assert.equal(lf.isFilterFileName('sub\\evil.filter'), false)
  assert.equal(lf.isFilterFileName('C:evil.filter'), false)
  assert.equal(lf.isFilterFileName('.hidden.filter'), false)
  assert.equal(lf.isFilterFileName('notes.txt'), false)
  assert.equal(lf.addonFileName('NeverSink Strict.filter'), 'NeverSink Strict + Orbhoarder.filter')
  assert.equal(lf.addonFileName('NeverSink Strict + Orbhoarder.filter'), null)
  assert.equal(lf.addonFileName('../x.filter'), null)
  assert.equal(lf.gemBaseType('Added Fire Damage', true), 'Added Fire Damage Support')
  assert.equal(lf.gemBaseType('Added Fire Damage Support', true), 'Added Fire Damage Support')
  assert.equal(lf.gemBaseType('Arc', false), 'Arc')
})

test('loot filter: wants from Shopping rows, cleaned, blocks first', () => {
  const lf = lootFilter
  const w = lf.wantsFromShop([
    { kind: 'unique', owned: false, name: 'Leather Belt' },
    { kind: 'unique', owned: true, name: 'Heavy Belt' },
    { kind: 'rare', owned: false, name: 'Vaal Regalia' },
    { kind: 'gem', owned: false, name: 'Added Fire Damage', support: true },
    { kind: 'gem', owned: false, name: 'Arc' }
  ])
  assert.deepEqual(w, { bases: ['Vaal Regalia'], uniqueBases: ['Leather Belt'], gems: ['Added Fire Damage Support', 'Arc'] })
  const { wants, refused } = lf.cleanWants({ bases: ['Vaal Regalia', 'vaal regalia', 'x"y'], uniqueBases: 'nope', gems: [7, 'Arc'] })
  assert.deepEqual(wants, { bases: ['Vaal Regalia'], uniqueBases: [], gems: ['Arc'] })
  assert.deepEqual(refused, ['x"y'])
  const text = lf.addonBlocks(w, { source: 'Mine.filter', game: 'poe1', when: '2026-11-21' })
  assert.ok(text.startsWith(lf.ADDON_MARKER))
  assert.ok(lf.isAddonText('﻿' + text))
  assert.match(text, /Rarity Unique\r\n {2}BaseType == "Leather Belt"/)
  assert.match(text, /BaseType == "Vaal Regalia"/)
  assert.match(text, /Class == "Skill Gems" "Support Gems"\r\n {2}BaseType == "Added Fire Damage Support" "Arc"/)
  assert.equal(/Gems/.test(lf.addonBlocks(w, { source: 'Mine.filter', game: 'poe2' })), false)
  assert.equal(lf.isAddonText('Show\n'), false)
})

test('loot filter files: only the add-on is written, his filter untouched, no escapes', async () => {
  const { mkdtempSync, writeFileSync, readFileSync, symlinkSync, existsSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'lf-'))
  const outside = mkdtempSync(join(tmpdir(), 'lf-out-'))
  const mine = '﻿Show\n  BaseType "Exalted Orb"\nHide\n'
  writeFileSync(join(dir, 'Mine.filter'), mine)
  writeFileSync(join(outside, 'Secret.filter'), 'secret')
  let linked = true
  try { symlinkSync(join(outside, 'Secret.filter'), join(dir, 'Link.filter')) } catch { linked = false }
  const wants = { bases: ['Vaal Regalia'], uniqueBases: [], gems: [] }

  // a link is not listed (only real files)
  assert.deepEqual(await lootFiles.listFilters(dir), ['Mine.filter'])

  const res = await lootFiles.makeAddon(dir, 'Mine.filter', wants, 'poe1', '2026-11-21')
  assert.equal(res.ok, true)
  assert.equal(res.written, 'Mine + Orbhoarder.filter')
  const out = readFileSync(join(dir, 'Mine + Orbhoarder.filter'), 'utf8')
  assert.ok(out.startsWith('# Orbhoarder loot filter add-on'))
  assert.ok(out.endsWith('Show\n  BaseType "Exalted Orb"\nHide\n'))
  assert.equal(readFileSync(join(dir, 'Mine.filter'), 'utf8'), mine)
  // ours again: replaced; listed filters never include it
  assert.equal((await lootFiles.makeAddon(dir, 'Mine.filter', wants, 'poe1')).ok, true)
  assert.deepEqual(await lootFiles.listFilters(dir), ['Mine.filter'])

  // refused: other folders, our own add-on as source, nothing to add, someone else's file of our name
  assert.equal((await lootFiles.makeAddon(dir, '../x.filter', wants, 'poe1')).ok, false)
  assert.equal((await lootFiles.makeAddon(dir, 'Mine + Orbhoarder.filter', wants, 'poe1')).ok, false)
  assert.equal((await lootFiles.makeAddon(dir, 'Mine.filter', { bases: [], uniqueBases: [], gems: [] }, 'poe1')).ok, false)
  writeFileSync(join(dir, 'Other.filter'), 'Show\n')
  writeFileSync(join(dir, 'Other + Orbhoarder.filter'), 'his own file')
  assert.equal((await lootFiles.makeAddon(dir, 'Other.filter', wants, 'poe1')).ok, false)
  assert.equal(readFileSync(join(dir, 'Other + Orbhoarder.filter'), 'utf8'), 'his own file')
  if (linked) {
    // a link to a file outside the folder is not read
    const r = await lootFiles.makeAddon(dir, 'Link.filter', wants, 'poe1')
    assert.equal(r.ok, false)
    assert.equal(existsSync(join(dir, 'Link + Orbhoarder.filter')), false)
    // a link in place of the add-on is not followed
    symlinkSync(join(outside, 'Secret.filter'), join(dir, 'Other2 + Orbhoarder.filter'))
    writeFileSync(join(dir, 'Other2.filter'), 'Show\n')
    assert.equal((await lootFiles.makeAddon(dir, 'Other2.filter', wants, 'poe1')).ok, false)
    assert.equal(readFileSync(join(outside, 'Secret.filter'), 'utf8'), 'secret')
  }
})

test('loot filter: only names the item data knows; transfigured gems as their normal gem; capped lists', () => {
  const lf = lootFilter
  const bases = new Set(['Vaal Regalia', 'Leather Belt'])
  const gems = { Arc: { refName: 'Arc' }, 'Arc of Surging': { refName: 'Arc of Surging', transfigured: true, normalVariant: 'Arc' }, 'Added Fire Damage Support': { refName: 'Added Fire Damage Support' } }
  const known = {
    base: n => bases.has(n),
    gem: n => { const g = gems[n]; return !g ? null : (g.transfigured ? g.normalVariant ?? null : g.refName) }
  }
  const res = lf.keepKnown({ bases: ['Vaal Regalia', 'Made Up Base'], uniqueBases: ['Leather Belt', 'Nope Belt'], gems: ['Arc of Surging', 'Arc', 'Added Fire Damage Support', 'Fake Gem'] }, known)
  assert.deepEqual(res.wants, { bases: ['Vaal Regalia'], uniqueBases: ['Leather Belt'], gems: ['Arc', 'Added Fire Damage Support'] })
  assert.deepEqual(res.unknown, ['Made Up Base', 'Nope Belt', 'Fake Gem'])
  const many = Array.from({ length: 120 }, (_, i) => `bad"${i}`)
  assert.equal(lf.cleanWants({ bases: many }).refused.length, lf.MAX_REFUSED)
  assert.equal(lf.keepKnown({ bases: Array.from({ length: 120 }, (_, i) => `Base ${i}`), uniqueBases: [], gems: [] }, known).unknown.length, lf.MAX_REFUSED)
})

test('request guard: phones cannot make or list loot filters', () => {
  assert.equal(guard.allowedFromOtherDevice('CLIENT->MAIN::loot-filter', { op: 'list' }), false)
  assert.equal(guard.allowedFromOtherDevice('CLIENT->MAIN::loot-filter', { op: 'make' }), false)
})

test('lab helper: trial ticks from Client.txt (Q7)', async () => {
  const lab = await import('./.build/lab-helper.mjs')
  assert.equal(lab.TRIALS.length, 12)
  assert.equal(lab.TRIALS.filter(t => t.lab === 'normal').length, 6)
  // system messages only, naming a trial and "complete"
  assert.ok(lab.isTrialDoneText(': You have completed the Trial of Ascendancy.'))
  assert.ok(lab.isTrialDoneText(': Trial of Piercing Truth completed'))
  assert.ok(!lab.isTrialDoneText(': You have entered The Lower Prison.'))
  assert.ok(!lab.isTrialDoneText('#Someone: trial complete lol'))
  assert.ok(!lab.isTrialDoneText('Izaro: The trial is complete.'))

  const p = {}
  lab.labOnArea(p, '1_1_7_1', 9)
  assert.ok(lab.labOnTrialDone(p))
  assert.deepEqual(p.trials, ['1_1_7_1'])
  assert.ok(!lab.labOnTrialDone(p), 'once')
  // a trial message outside a trial zone ticks nothing
  lab.labOnArea(p, '1_1_8', 10)
  assert.ok(!lab.labOnTrialDone(p))
  // the plaza says nothing about the difficulty
  lab.labOnArea(p, 'Labyrinth_Airlock', 33)
  assert.ok(!p.inLab)
  // inside the Normal lab: all six normal trials are done
  lab.labOnArea(p, '1_Labyrinth_boss_3', 33)
  assert.equal(p.inLab, 'normal')
  assert.equal(lab.trialRows(p, undefined)[0].done, 6)
  assert.equal(lab.trialRows(p, undefined)[1].done, 0)
  assert.equal(lab.labsDone(p, undefined), 0)
  assert.ok(lab.isIzaroDefeat('Izaro', 'Triumphant at last! …'))
  assert.ok(!lab.isIzaroDefeat('Someone', 'Triumphant at last!'))
  assert.ok(lab.labOnIzaro(p))
  assert.ok(!lab.labOnIzaro(p))
  assert.equal(lab.labsDone(p, undefined), 1)
  lab.labOnArea(p, '1_3_1', 30)
  assert.equal(p.inLab, null)
  assert.ok(!lab.labOnIzaro(p), 'not in a lab')

  // manual ticks override the log
  assert.equal(lab.trialDone('1_1_7_1', p, { trials: { '1_1_7_1': false } }), false)
  assert.equal(lab.trialDone('2_6_7_1', p, { trials: { '2_6_7_1': true } }), true)
  assert.equal(lab.labsDone(p, { labs: 3 }), 3)
  // labs count in order (Cruel without Normal isn't counted)
  assert.equal(lab.labsDone({ labs: ['cruel'] }, undefined), 0)
  assert.equal(lab.labFromLevel(55), 'cruel')
  assert.equal(lab.labFromLevel(68), 'merciless')
  assert.equal(lab.labFromLevel(75), 'eternal')

  // stored manual ticks are checked on load
  localStorage.setItem(lab.LAB_MANUAL_KEY, JSON.stringify({ A: { trials: { '1_1_7_1': true, bogus: true, '2_7_4': 'x' }, labs: 9 }, B: 3 }))
  assert.deepEqual(lab.loadLabManual(), { A: { trials: { '1_1_7_1': true }, labs: undefined } })
  localStorage.setItem(lab.LAB_MANUAL_KEY, '[1]')
  assert.deepEqual(lab.loadLabManual(), {})
})


test('lab helper: lab areas, higher lab implies lower ones done (Q7)', async () => {
  const lab = await import('./.build/lab-helper.mjs')
  // campaign / Eternal lab rooms only; map trials and other "Labyrinth" ids don't count
  assert.ok(lab.isLabProper('1_Labyrinth_boss_3'))
  assert.ok(lab.isLabProper('EndGame_Labyrinth_boss_1'))
  assert.ok(!lab.isLabProper('EndGame_Labyrinth_trials_spikes'))
  assert.ok(!lab.isLabProper('Labyrinth_Airlock'))
  assert.ok(lab.isLabArea('Labyrinth_Airlock'))
  assert.ok(!lab.isLabArea('MapWorldsLabyrinth'))
  const t = {}
  lab.labOnArea(t, 'EndGame_Labyrinth_trials_spikes', 75)
  assert.equal(t.inLab, null)
  assert.equal(t.labs, undefined)
  // straight into Merciless: Normal and Cruel labs and all 12 trials are done
  const p = {}
  assert.ok(lab.labOnArea(p, '3_Labyrinth_1', 68))
  assert.equal(p.inLab, 'merciless')
  assert.deepEqual(p.labs, ['normal', 'cruel'])
  assert.equal(lab.labsDone(p, undefined), 2)
  assert.equal(p.trials.length, 12)
  // the next room changes nothing but the area
  lab.labOnArea(p, '3_Labyrinth_2', 68)
  assert.deepEqual(p.labs, ['normal', 'cruel'])

  // stored manual ticks: names that would reach the prototype are dropped
  localStorage.setItem(lab.LAB_MANUAL_KEY, '{"__proto__":{"labs":2},"constructor":{"labs":1},"B":{"labs":2}}')
  const m = lab.loadLabManual()
  assert.deepEqual(Object.keys(m), ['B'])
  assert.equal(Object.getPrototypeOf(m), Object.prototype)
  assert.equal(m.labs, undefined)
})

test('lab helper: ascendancy from the levelling plan (Q7)', async () => {
  const lab = await import('./.build/lab-helper.mjs')
  // PobPlan.ascendancy as the PoB fork sends it: only what THIS levelling tree
  // adds over the previous one, sorted by name, no multiple-choice options
  const tree1 = [{ id: 1950, name: 'Bane of Legends' }, { id: 4917, name: 'Endless Hunger' }]
  const tree2 = [{ id: 7136, name: 'Brutal Fervour' }, { id: 1950, name: 'Bane of Legends' }]

  // first lab: what tree 1 adds, no order claimed
  let v = lab.ascendancyView(tree1, 0)
  assert.equal(v.lab, 'normal')
  assert.deepEqual(v.adds.map(n => n.name), ['Bane of Legends', 'Endless Hunger'])
  assert.deepEqual(v.taken, [])
  assert.equal(v.smalls, null, 'no layout: small passives not known')

  // after the Normal lab on the same tree: the log shows one taken, the other still to take
  v = lab.ascendancyView(tree1, 1, { alloc: { 'Bane of Legends': 1, 'Iron Reflexes': 1 } })
  assert.equal(v.lab, 'cruel')
  assert.deepEqual(v.adds.map(n => n.name), ['Endless Hunger'])
  assert.deepEqual(v.taken.map(n => n.name), ['Bane of Legends'])
  // refunded in the log (count 0): not taken
  v = lab.ascendancyView(tree1, 1, { alloc: { 'Bane of Legends': 0 } })
  assert.equal(v.adds.length, 2)

  // second tree: only its own additions (not tree 1's), duplicates out
  v = lab.ascendancyView(tree2, 1, { alloc: { 'Bane of Legends': 1, 'Endless Hunger': 1 } })
  assert.deepEqual(v.adds.map(n => n.name), ['Brutal Fervour'])
  assert.deepEqual(v.taken.map(n => n.name), ['Bane of Legends'])
  // all four labs done
  assert.equal(lab.ascendancyView(tree2, 4).lab, null)
  // nothing added by this tree
  assert.deepEqual(lab.ascendancyView([], 2).adds, [])

  // with the tree layout: a main-tree passive of the same name isn't taken as the
  // ascendancy one; small passives on the way are counted from what's taken
  const N = (id, kind, name, asc = 'Slayer') => [id, 0, 0, kind, 0, 0, name, asc, []]
  const layout = {
    nodes: [
      N(1, 6, 'Slayer'), N(2, 0, 'Damage'), N(1950, 1, 'Bane of Legends'), N(3, 0, 'Life Leech'), N(4917, 1, 'Endless Hunger'),
      N(5, 0, 'Area of Effect'), N(7136, 1, 'Brutal Fervour'), N(500, 1, 'Endless Hunger', false), N(99, 1, 'Other', 'Berserker')
    ],
    links: [[1, 2], [2, 1950], [1, 3], [3, 4917], [2, 5], [5, 7136], [7136, 99]]
  }
  v = lab.ascendancyView(tree1, 0, { layout, alloc: { 'Endless Hunger': 1 } })
  assert.deepEqual(v.taken, [], 'same name on the main tree: ambiguous, not counted')
  assert.equal(v.smalls, 2, 'Damage + Life Leech from the start')
  // tree 2 after Normal, log followed from level 2: Bane of Legends and its small
  // passive are taken, so only Area of Effect is on the way to Brutal Fervour
  v = lab.ascendancyView(tree2, 1, { layout, alloc: { 'Bane of Legends': 1, Damage: 1 }, logComplete: true })
  assert.deepEqual(v.adds.map(n => n.name), ['Brutal Fervour'])
  assert.equal(v.smalls, 1)
  // start not known (labs done, log not from the start): no count claimed
  assert.equal(lab.ascendancyView(tree2, 1, { layout, alloc: {} }).smalls, null)

  // campaign guide's lab banner: the plaza guesses the next lab, the first room sets it
  let b = lab.labBannerOnArea(null, 'Labyrinth_Airlock', 33, 1)
  assert.deepEqual(b, { lab: 'cruel', level: null, done: false })
  b = lab.labBannerOnArea(b, '2_Labyrinth_1', 55, 1)
  assert.deepEqual(b, { lab: 'cruel', level: 55, done: false })
  assert.equal(lab.labBannerOnArea(b, '2_Labyrinth_2', 55, 1), b)
  const done = { ...b, done: true }
  assert.equal(lab.labBannerOnArea(done, '2_Labyrinth_boss_3', 55, 2), done, 'treasure room keeps "done"')
  assert.equal(lab.labBannerOnArea(b, '1_3_town', 30, 1), null)
  assert.equal(lab.labBannerOnArea(null, 'EndGame_Labyrinth_trials_spikes', 75, 3), null)
  // its ascendancy line: this tree's notables not taken yet; empty without a plan
  assert.deepEqual(lab.labBannerAscendancy(tree1, { 'Bane of Legends': 1 }), ['Endless Hunger'])
  assert.deepEqual(lab.labBannerAscendancy(undefined), [])
})

test('loot filter part 2 (Q11): settings, signatures, automatic rewrite', async () => {
  const lf = lootFilter
  assert.deepEqual(lf.parseLfSettings('{"source":"Mine.filter","auto":true}'), { source: 'Mine.filter', auto: true })
  assert.deepEqual(lf.parseLfSettings('{"source":"../x.filter","auto":true}'), { source: '', auto: false })
  assert.deepEqual(lf.parseLfSettings('{"source":"Mine + Orbhoarder.filter","auto":true}'), { source: '', auto: false })
  assert.deepEqual(lf.parseLfSettings('nope'), { source: '', auto: false })
  assert.equal(lf.parseLfWants('{"at":"x","wants":{"bases":["a\\"b","Vaal Regalia"]}}').wants.bases.length, 1)
  assert.equal(lf.wantsSignature({ bases: ['B', 'a'], uniqueBases: [], gems: [] }), lf.wantsSignature({ bases: ['A', 'b'], uniqueBases: [], gems: [] }))
  assert.notEqual(lf.wantsSignature({ bases: ['a'], uniqueBases: [], gems: [] }), lf.wantsSignature({ bases: [], uniqueBases: ['a'], gems: [] }))

  const { mkdtempSync, writeFileSync, readFileSync, statSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'lf2-'))
  writeFileSync(join(dir, 'Mine.filter'), 'Hide\n')
  const wants = { bases: ['Vaal Regalia'], uniqueBases: [], gems: [] }
  const first = await lootFiles.makeAddon(dir, 'Mine.filter', wants, 'poe1', '2026-11-27')
  assert.equal(first.ok, true)
  assert.equal(first.unchanged, undefined)
  const out = join(dir, 'Mine + Orbhoarder.filter')
  const t1 = statSync(out).mtimeMs
  // same list again: not written
  const again = await lootFiles.makeAddon(dir, 'Mine.filter', wants, 'poe1', '2026-11-27')
  assert.equal(again.unchanged, true)
  assert.equal(statSync(out).mtimeMs, t1)
  // nothing left to buy: a button refuses, the automatic update writes just his filter
  const none = { bases: [], uniqueBases: [], gems: [] }
  assert.equal((await lootFiles.makeAddon(dir, 'Mine.filter', none, 'poe1')).ok, false)
  const empty = await lootFiles.makeAddon(dir, 'Mine.filter', none, 'poe1', '2026-11-27', { allowEmpty: true })
  assert.equal(empty.ok, true)
  assert.equal(empty.count, 0)
  const text = readFileSync(out, 'utf8')
  assert.ok(text.startsWith(lf.ADDON_MARKER))
  assert.equal(/BaseType/.test(text), false)
  assert.ok(text.endsWith('Hide\n'))
})

test('market tools (Q19): weekly farming report and profit-drop nudge', async () => {
  const mt = await import('./.build/market-tools.mjs')
  const DAY = 86_400_000
  const now = 100 * DAY
  let n = 0
  // one map: 6 minutes, loot in chaos, cost 0
  const run = (strategy, loot, daysAgo) => ({ id: String(n++), strategy, mechanics: [], loot, cost: 0, ms: 6 * 60_000, at: now - daysAgo * DAY })
  const runs = [
    ...Array.from({ length: 6 }, () => run('Breach', 100, 9)), // week before: 1000 c/h
    ...Array.from({ length: 6 }, () => run('Breach', 120, 2)), // this week: 1200 c/h
    ...Array.from({ length: 5 }, () => run('Essence', 50, 1)), // this week: 500 c/h
    run('Old', 999, 30) // too old for both weeks
  ]
  const w = mt.weeklyReport(runs, now)
  assert.equal(w.maps, 11)
  assert.equal(w.prev.maps, 6)
  assert.equal(Math.round(w.prev.perHour), 1000)
  assert.deepEqual(w.strategies.map(s => s.name), ['Breach', 'Essence'])
  assert.ok(w.tip.startsWith('Breach earned the most'))
  assert.match(w.tip, /58 % less/)
  assert.equal(mt.weeklyReport([run('X', 5, 20)], now), null, 'no maps this week')
  assert.equal(mt.weeklyReport([run('X', 5, 1)], now).change, null, 'too few maps to compare')

  // nudge: last 5 Breach maps make 40 c each (400 c/h) vs 100+ before
  const drop = [...runs, ...Array.from({ length: 5 }, () => run('Breach', 40, 0.5))]
  const d = mt.profitDrop(drop, 'Breach', now)
  assert.equal(d.strategy, 'Breach')
  assert.equal(Math.round(d.recent), 400)
  assert.ok(d.drop > 0.6)
  assert.equal(d.better.name, 'Essence', 'Essence (500 c/h) beats the recent 400 c/h')
  assert.equal(mt.profitDrop(runs, 'Breach', now), null, 'no drop: the last maps are the best ones')
  assert.equal(mt.profitDrop(drop, 'Essence', now), null, 'too few maps')
  assert.equal(mt.profitDrop(drop.map(r => ({ ...r, strategy: 'No strategy set' })), '', now).strategy, 'No strategy set')
})

test('gem profit (Q15): variants, best route per gem, prisms, slot-days, tracked gems', async () => {
  const gp = await import('./.build/gem-profit.mjs')
  const G = (name, variant, chaos) => ({ ns: 'GEM', name, variant, chaos, graph: [], category: 'skill-gems', type: 'SkillGem', url: 'u' })
  assert.deepEqual(gp.parseGemVariant('21/20c'), { level: 21, quality: 20, corrupt: true })
  assert.deepEqual(gp.parseGemVariant('1'), { level: 1, quality: 0, corrupt: false })
  assert.equal(gp.parseGemVariant('Imbued'), null)
  assert.equal(gp.defaultDays('Awakened Added Fire Damage Support', 2), 6)
  assert.equal(gp.defaultDays('Enlighten Support', 2), 10)
  assert.equal(gp.defaultDays('Arc', 0), 3)
  const items = [
    G('Arc', '1', 1), G('Arc', '1/20', 6), G('Arc', '20', 10), G('Arc', '20/20', 30), G('Arc', '21/20c', 80),
    G('Awakened Spell Echo Support', '1', 50), G('Awakened Spell Echo Support', '5', 350),
    G('Only One', '20', 5), // nothing to level
    { ns: 'ITEM', name: "Gemcutter's Prism", chaos: 0.5, graph: [], category: 'currency', type: 'Currency', url: 'u' }
  ]
  const r = gp.gemRoutes(items, 0.5, 2)
  const arc = r.find(p => p.name === 'Arc')
  // 1/20 → 20/20 (30 - 6 = 24) beats 1 → 20/20 with 20 prisms (30 - 1 - 10 = 19)
  assert.equal(arc.buy.variant, '1/20')
  assert.equal(arc.sell.variant, '20/20')
  assert.equal(arc.prisms, 0)
  assert.equal(arc.profit, 24)
  assert.equal(arc.perDay, 12)
  const aw = r.find(p => p.name === 'Awakened Spell Echo Support')
  assert.equal(aw.days, 6)
  assert.equal(aw.perDay, 50)
  assert.equal(r[0].name, 'Awakened Spell Echo Support') // sorted by per slot-day
  assert.equal(r.some(p => p.name === 'Only One'), false)
  // prisms needed but no prism price: route skipped
  assert.equal(gp.gemPlan(items[0], items[3], null, 2), null)
  assert.equal(gp.gemPlan(items[0], items[3], 0.5, 2).profit, 19)
  // tracked: paid price counts, today's sell price
  const t = { name: 'Arc', buy: '1', sell: '20/20', paid: 2, days: 4, started: 0 }
  assert.equal(gp.trackedPlan(t, items, 0.5).profit, 18)
  assert.equal(gp.trackedPlan({ ...t, sell: '19' }, items, 0.5), null)
  assert.equal(gp.dayOf(0, 0), 1)
  assert.equal(gp.dayOf(0, 2.5 * 86_400_000), 3)
})

test('bulk sell (Q16): exchange ratios, bulk quotes, compare, WTS line', async () => {
  const bs = await import('./.build/bulk-sell.mjs')
  const D = 200
  assert.equal(bs.parseExchange('12', D), 12)
  assert.equal(bs.parseExchange('12c', D), 12)
  assert.equal(bs.parseExchange('0,5 div', D), 100)
  assert.equal(bs.parseExchange('8/div', D), 25)
  assert.equal(bs.parseExchange('8 per div', D), 25)
  assert.equal(bs.parseExchange('5/c', D), 0.2)
  assert.equal(bs.parseExchange('40:3', D), 0.075)
  assert.equal(bs.parseExchange('40 for 1 div', D), 5)
  assert.equal(bs.parseExchange('1 div', undefined), null) // no divine price yet
  assert.equal(bs.parseExchange('lots', D), null)
  assert.equal(bs.parseExchange('', D), null)
  assert.equal(bs.parseExchange('0/div', D), null)
  assert.equal(bs.bulkRatio(400, D), '2 div each')
  assert.equal(bs.bulkRatio(25, D), '25 c each (8 per div)')
  assert.equal(bs.bulkRatio(150, D), '150 c each')
  assert.equal(bs.bulkRatio(0.2, D), '5 per chaos')
  assert.equal(bs.bulkRatio(0, D), '–')
  assert.equal(bs.bulkTotal(500, D), '2.5 div')
  assert.equal(bs.bulkTotal(3.04, D), '3 c')
  assert.equal(bs.compareExchange(11, 10).tone, 'exchange')
  assert.equal(bs.compareExchange(9, 10).text, 'Exchange pays 10% less')
  assert.equal(bs.compareExchange(10.2, 10).tone, 'same')
  assert.equal(bs.compareExchange(null, 10), null)
  assert.equal(bs.askEach(12, 10), 12)
  assert.equal(bs.askEach(8, 10), 10)
  assert.equal(bs.askEach(null, 10), 10)
  assert.equal(bs.askEach(5, null), 5)
  assert.equal(bs.wtsLine([{ label: 'Orb of Alteration', qty: 100, each: 0.2 }, { label: 'X', qty: 1, each: null }], D),
    'WTS 100x Orb of Alteration at 5 per chaos, 20 c for all')
  assert.equal(bs.wtsLine([{ label: 'Divine Orb', qty: 2, each: 200 }, { label: 'Exalted Orb', qty: 10, each: 25 }], D),
    'WTS 2x Divine Orb at 1 div each, 2 div for all | 10x Exalted Orb at 25 c each (8 per div), 1.3 div for all')
  assert.equal(bs.wtsLine([], D), '')
})
