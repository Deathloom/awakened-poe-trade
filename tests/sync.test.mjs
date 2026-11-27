// Deathloom fork (S5): cross-window sync. "One window didn't update" is the most
// repeated bug (#136, #157, #227, #272); these check the broadcast decision and
// that every panel showing the build listens for it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (f) => readFileSync(join(root, f), 'utf8')
const { shouldAnnounce } = await import('./.build/pob-announce.mjs')

test('sync (S5): build, loadout, character and player switches reach every window', () => {
  const B = 'CLIENT->MAIN::pob-builds'
  assert.equal(shouldAnnounce(B, { requestId: 1 }), false, 'a plain list request answers only the asker')
  assert.equal(shouldAnnounce(B, { setActive: 'a/b.xml' }), true)
  assert.equal(shouldAnnounce(B, { setLoadout: { tree: 1 } }), true)
  assert.equal(shouldAnnounce(B, { setCharacter: 'Bob' }), true)
  assert.equal(shouldAnnounce(B, { setPlayer: '' }), true, 'switching back to yourself (empty player) too')
  assert.equal(shouldAnnounce(B, { setActive: '' }), false)
})

test('sync (S5): loadout set changes broadcast, single edits do not', () => {
  const E = 'CLIENT->MAIN::pob-edit'
  for (const op of ['newLoadout', 'copySet', 'deleteSet']) assert.equal(shouldAnnounce(E, { ops: [{ op }] }), true, op)
  assert.equal(shouldAnnounce(E, { ops: [{ op: 'togglePassive' }] }), false)
  assert.equal(shouldAnnounce(E, { ops: [null, { op: 'gem' }, { op: 'copySet' }] }), true)
  assert.equal(shouldAnnounce(E, { ops: 'copySet' }), false)
  assert.equal(shouldAnnounce(E, {}), false)
})

test('sync (S5): managing build files broadcasts (active build can move)', () => {
  const M = 'CLIENT->MAIN::pob-manage-build'
  for (const op of ['rename', 'move', 'duplicate', 'delete']) assert.equal(shouldAnnounce(M, { op, path: 'x.xml' }), true, op)
  assert.equal(shouldAnnounce(M, { op: 'format-disk' }), false)
  assert.equal(shouldAnnounce(M, null), false)
  assert.equal(shouldAnnounce('CLIENT->MAIN::pob-tree', { refreshGear: true }), false)
})

test('sync (S5): PobImpact uses the helper for each request and broadcasts to all windows', () => {
  const impact = src('main/src/pob/PobImpact.ts')
  for (const name of ['pob-builds', 'pob-edit', 'pob-manage-build']) {
    assert.match(impact, new RegExp(`shouldAnnounce\\('CLIENT->MAIN::${name}'`), `${name} decides with shouldAnnounce`)
  }
  assert.match(impact, /sendEventTo\('broadcast', \{\s*name: 'MAIN->CLIENT::pob-character'/, 'announce goes to every window')
  assert.match(src('main/src/server.ts'), /if \(target === 'broadcast'\) \{\s*for \(const client of websocketServer\.clients\)/, 'broadcast sends to every socket')
})

test('sync (S5): every panel showing the build asks again on pob-character', () => {
  for (const f of ['BuildPicker.vue', 'PobTree.vue', 'PobTreeMap.vue', 'PobGems.vue']) {
    assert.match(src(`renderer/src/web/pob/${f}`), /onEvent\('MAIN->CLIENT::pob-character', \(\) => \{ request\(\) \}\)/, f)
  }
})
