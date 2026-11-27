// Deathloom fork (Q28): spoken callouts (renderer/src/web/callouts/callouts.ts)
import test from 'node:test'
import assert from 'node:assert/strict'

const c = await import('./.build/callouts.mjs')

test('settings: off by default, junk and out-of-range values cleaned', () => {
  const d = c.readCalloutSettings(null)
  assert.equal(d.on, false)
  assert.deepEqual(d.kinds, { whisper: true, priceAlert: true, map: true, health: true })
  const r = c.readCalloutSettings({ on: true, voice: 5, rate: 9, volume: -1, kinds: { map: false } })
  assert.equal(r.on, true)
  assert.equal(r.voice, '')
  assert.equal(r.rate, 2)
  assert.equal(r.volume, 0)
  assert.equal(r.kinds.map, false)
  assert.equal(r.kinds.whisper, true)
  assert.equal(c.readCalloutSettings({ on: 'yes' }).on, false)
})

test('sayable strips odd characters and caps length', () => {
  assert.equal(c.sayable('  Hi <b>there</b>\n\u0007  '), 'Hi b there /b')
  assert.equal(c.sayable('x'.repeat(500)).length, c.MAX_CALLOUT_CHARS)
  assert.equal(c.sayable('Kaom’s Heart'), 'Kaom s Heart')
})

test('whisper: incoming only, item and price', () => {
  assert.equal(c.whisperCallout({ direction: 'to', item: 'Tabula Rasa', price: '5 chaos' }), null)
  assert.equal(c.whisperCallout({ direction: 'from', item: 'Tabula Rasa Simple Robe', price: '5 div' }), 'Trade: Tabula Rasa Simple Robe, for 5 divine')
  assert.equal(c.whisperCallout({ direction: 'from', item: 'Mageblood', price: '' }), 'Trade: Mageblood')
  assert.equal(c.whisperCallout({ direction: 'from', item: '<<>>', price: '' }), null)
})

test('price alert, map and health texts', () => {
  assert.equal(c.priceAlertCallout({ label: 'Mageblood', dir: 'below', value: 150, unit: 'div' }), 'Price alert: Mageblood is below 150 divine')
  assert.equal(c.mapCallout(0), null)
  assert.match(c.mapCallout(1), /one map mod/)
  assert.match(c.mapCallout(3), /3 map mods/)
  assert.equal(c.healthCallout('Path of Building stopped unexpectedly.'), 'Path of Building stopped unexpectedly.')
})

test('gate: one callout per few seconds, same words not within 30 s', () => {
  const g = new c.CalloutGate()
  assert.equal(g.allow('a', 0), true)
  assert.equal(g.allow('b', 1000), false)
  assert.equal(g.allow('b', c.ANY_GAP_MS), true)
  assert.equal(g.allow('a', c.ANY_GAP_MS * 3), false)
  assert.equal(g.allow('a', c.SAME_TEXT_GAP_MS + 1), true)
  assert.equal(g.allow('', 10 * c.SAME_TEXT_GAP_MS), false)
})

test('pickVoice never picks a network voice', () => {
  const voices = [
    { name: 'Google UK', localService: false, default: true },
    { name: 'Microsoft Zira', localService: true, default: false },
    { name: 'Microsoft David', localService: true, default: true }
  ]
  assert.equal(c.pickVoice(voices, 'Google UK').name, 'Microsoft David')
  assert.equal(c.pickVoice(voices, 'Microsoft Zira').name, 'Microsoft Zira')
  assert.equal(c.pickVoice(voices, '').name, 'Microsoft David')
  assert.equal(c.pickVoice([voices[0]], ''), null)
})
