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
