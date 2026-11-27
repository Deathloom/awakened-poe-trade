// Deathloom fork (Q22, Q23): build diff on Pull and friends' board matching.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { findChanges, mergeChanges, parseIndex, takeSnapshot, PullDiffStore, KEEP } = await import('./.build/pull-diff.mjs')
const { compareBuilds, changeLines } = await import('./.build/build-compare.mjs')
const { boardMatches, sameThing, unseen, parseWants, parseSeen, pingText } = await import('./.build/board-matching.mjs')

const B = (s) => Buffer.from(s)

test('pull diff (Q22): only changed files, and new files of known players', () => {
  const before = new Map([['Ann/A.xml', B('1')], ['Ann/B.xml', B('2')]])
  const after = new Map([['Ann/A.xml', B('1')], ['Ann/B.xml', B('3')], ['Ann/C.xml', B('4')], ['Bob/X.xml', B('5')]])
  const ch = findChanges(before, after, 1000)
  assert.deepEqual(ch.map(c => [c.rel, c.kind]), [['Ann/B.xml', 'changed'], ['Ann/C.xml', 'new']], "a first Pull of Bob's builds isn't news")
  assert.equal(ch[0].player, 'Ann')
  assert.equal(ch[0].name, 'B')
  assert.match(ch[0].id, /^[a-f0-9]{16}$/)
  assert.deepEqual(findChanges(new Map(), after, 1), [], 'very first Pull: nothing listed')
})

test('pull diff (Q22): newest entry per build wins, capped, dropped ones returned', () => {
  const mk = (rel, time) => ({ id: String(time).padStart(16, '0'), rel, player: 'A', name: rel, kind: 'changed', time })
  const { keep, drop } = mergeChanges([mk('A/x.xml', 1)], [mk('A/x.xml', 2), mk('A/y.xml', 2)])
  assert.deepEqual(keep.map(c => c.time), [2, 2])
  assert.deepEqual(drop.map(c => c.time), [1])
  const many = Array.from({ length: KEEP + 5 }, (_, i) => mk(`A/${i}.xml`, i + 10))
  assert.equal(mergeChanges([], many).keep.length, KEEP)
})

test('pull diff (Q22): index file is checked (ids, no .. in paths)', () => {
  const ok = { id: 'a'.repeat(16), rel: 'A/b.xml', player: 'A', name: 'b', kind: 'changed', time: 1 }
  assert.equal(parseIndex(JSON.stringify([ok])).length, 1)
  assert.equal(parseIndex(JSON.stringify([{ ...ok, id: '../../x' }])).length, 0)
  assert.equal(parseIndex(JSON.stringify([{ ...ok, rel: 'A/../../evil.xml' }])).length, 0)
  assert.deepEqual(parseIndex('nonsense'), [])
})

test('pull diff (Q22): snapshot skips your own folder; store keeps the old copy', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pd-'))
  try {
    const builds = join(dir, 'builds')
    mkdirSync(join(builds, 'Me'), { recursive: true })
    mkdirSync(join(builds, 'Ann', '3.30'), { recursive: true })
    writeFileSync(join(builds, 'Me', 'mine.xml'), 'mine')
    writeFileSync(join(builds, 'Ann', '3.30', 'RF.xml'), 'old')
    const before = await takeSnapshot(builds, 'me')
    assert.deepEqual([...before.keys()], ['Ann/3.30/RF.xml'])
    writeFileSync(join(builds, 'Ann', '3.30', 'RF.xml'), 'new')
    writeFileSync(join(builds, 'Me', 'mine.xml'), 'changed')
    const store = new PullDiffStore(join(dir, 'pd'))
    const list = await store.record(before, builds, 'Me')
    assert.equal(list.length, 1)
    const old = await store.oldText(list[0].id)
    assert.equal(old.text, 'old')
    assert.equal(await store.oldText('../index'), null)
    await store.clear()
    assert.deepEqual(await store.list(), [])
    assert.equal(existsSync(join(dir, 'pd', `${list[0].id}.xml`)), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('pull diff (Q22): change lines for stats, gear, gems, tree', () => {
  const base = { stats: { Life: 4000, CombinedDPS: 1e6 }, groups: [{ enabled: true, gems: [{ name: 'Fireball', level: 20, enabled: true }, { name: 'Hypothermia', level: 20, enabled: true }] }],
    items: [{ slot: 'Helmet', rarity: 'Rare', name: 'Doom Crown', base: 'Hubris Circlet', mods: ['+80 to maximum Life'] }], tree: { nodes: [1, 2, 3], masteries: {} } }
  const next = { stats: { Life: 4500, CombinedDPS: 9e5 }, groups: [{ enabled: true, gems: [{ name: 'Fireball', level: 21, enabled: true }, { name: 'Elemental Focus', level: 20, enabled: true }] }],
    items: [{ slot: 'Helmet', rarity: 'Rare', name: 'Doom Crown', base: 'Hubris Circlet', mods: ['+90 to maximum Life', '+40% to Fire Resistance'] }], tree: { nodes: [1, 2, 4, 5], masteries: {} } }
  const lines = changeLines(compareBuilds(base, next))
  const by = (s) => lines.filter(l => l.section === s).map(l => l.text)
  assert.ok(by('stats').some(t => t.startsWith('Life: 4000 → 4500')))
  assert.equal(lines.find(l => l.text.startsWith('Combined DPS')).tone, 'down')
  assert.deepEqual(by('gear'), ['Helmet: Doom Crown (Hubris Circlet) (1 new mod, 1 roll changed)'])
  assert.ok(by('gems').includes('+ Elemental Focus (level 20)'))
  assert.ok(by('gems').includes('− Hypothermia'))
  assert.ok(by('gems').includes('Fireball: level 20 → 21'))
  assert.deepEqual(by('tree'), ['Passives: 2 added, 1 removed'])
  assert.deepEqual(changeLines(compareBuilds(base, base)), [])
})

test('board matching (Q23): Shopping list exact, typed wants loose, offers vs friends wanted', () => {
  const L = (number, kind, name, mine = false, extra = {}) => ({ number, kind, name, mine, ...extra })
  const listings = [
    L(1, 'sell', 'Tabula Rasa', false, { base: 'Simple Robe' }),
    L(2, 'give', 'Awakened Multistrike Support'),
    L(3, 'sell', 'Headhunter'),
    L(4, 'wanted', 'Watcher\'s Eye please'),
    L(5, 'wanted', 'Mageblood', false, { league: 'Standard' }),
    L(10, 'wanted', '6-link Headhunter', true),
    L(11, 'sell', "Watcher's Eye", true, { base: 'Prismatic Jewel' }),
    L(12, 'give', 'Mageblood', true, { league: 'Covens' }),
    L(13, 'sell', 'Mirror of Kalandra', true)
  ]
  const m = new Map(boardMatches(listings, ['tabula rasa', 'Multistrike Support']).map(x => [x.number, x.reason]))
  assert.equal(m.get(1), 'On your Shopping list')
  assert.equal(m.has(2), false, 'Shopping names match exactly')
  assert.equal(m.get(3), 'You want 6-link Headhunter')
  assert.equal(m.get(4), "You sell Watcher's Eye")
  assert.equal(m.has(5), false, 'other league')
  assert.equal([...m.keys()].some(n => n >= 10), false, 'never your own listings')
  assert.equal(sameThing('Superior Fireball', { name: 'Fireball' }), true)
  assert.equal(sameThing('Orb', { name: 'Orb of Fusing' }), false, 'short words do not match inside names')
})

test('board matching (Q23): ping once per listing, stored lists checked', () => {
  const a = { number: 1, reason: 'x' }
  const b = { number: 2, reason: 'y' }
  assert.deepEqual(unseen([a, b], [1]).fresh, [b])
  assert.deepEqual(unseen([b], [1, 2]).keep, [2], 'closed listings drop out of the seen list')
  assert.deepEqual(parseWants('{"names":["A",3,""]}'), ['A'])
  assert.deepEqual(parseSeen('[1,-2,"3",4.5,5]'), [1, 5])
  assert.match(pingText([{ ...a, name: 'Tabula Rasa', kind: 'sell', author: 'ann' }]).body, /ann sells Tabula Rasa/)
  assert.equal(pingText([{ ...a, name: 'A', kind: 'give', author: 'x' }, { ...b, name: 'B', kind: 'sell', author: 'y' }]).title, "Friends' board: 2 matches for you")
})
