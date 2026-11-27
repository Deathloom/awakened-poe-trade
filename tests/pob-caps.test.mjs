// Deathloom fork (S6): the overlay hides or explains what the running PoB can't do
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const caps = await import('./.build/pob-caps.mjs')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/pob-ready.json', import.meta.url), 'utf8'))
const ready = (line) => JSON.parse(line.slice('@pob '.length))

test('PoB caps: older pin without a list keeps what it could do', () => {
  const old = caps.pobCapsFromReady(ready(fixture.oldPin))
  assert.equal(old.reported, false)
  assert.equal(old.version, '2.68.1')
  for (const c of ['impact', 'equipped.file', 'timeless.find', 'craftMods', 'plan', 'treeMap', 'edit']) {
    assert.ok(caps.pobSupports(old, c), c)
  }
  // a command added after that pin is explained, not sent
  assert.equal(caps.pobSupports(old, 'somethingNew'), false)
  assert.match(caps.pobNeedsUpdate(old), /Path of Building \(2\.68\.1\) is older than this feature/)
})

test('PoB caps: a reported list is followed exactly', () => {
  const now = caps.pobCapsFromReady(ready(fixture.withCaps))
  assert.equal(now.reported, true)
  assert.equal(now.version, '2.69.0')
  assert.ok(!now.caps.includes('bad name!') && !now.caps.includes(42), 'junk entries dropped')
  assert.ok(caps.pobSupports(now, caps.pobCapFor('timeless', { sockets: true })))
  assert.equal(caps.pobSupports(now, caps.pobCapFor('timeless', { find: 'options' })), false)
  assert.equal(caps.pobSupports(now, caps.pobCapFor('craftBases')), false)
  assert.ok(caps.pobSupports(now, caps.pobCapFor('equipped', { file: 'C:/x.xml' })))
  assert.equal(caps.pobCapFor('equipped', { items: [] }), 'equipped')
  // not started yet: nothing hidden
  assert.ok(caps.pobSupports(null, 'anything'))
  // a ready line from something else (no fork marker) counts as an old copy
  assert.equal(caps.pobCapsFromReady({ ready: true, caps: ['x'] }).reported, false)
})
