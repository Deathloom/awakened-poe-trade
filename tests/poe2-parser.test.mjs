// Deathloom fork (A2): PoE2 parser (ported from Exiled Exchange 2) against the
// real PoE2 data files and EE2's own item texts (tests/fixtures/poe2/items.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'renderer', 'public')

globalThis.fetch = async (url) => {
  const buf = readFileSync(join(pub, String(url).replace(/^\//, '')))
  return {
    ok: true,
    text: async () => buf.toString('utf8'),
    json: async () => JSON.parse(buf.toString('utf8')),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }
}
// the trade data refresh timer must not keep the test process alive
const realSetInterval = globalThis.setInterval
globalThis.setInterval = (...a) => realSetInterval(...a).unref()
const quiet = console.error
console.error = () => {} // trade data download is offline on purpose
const poe2 = await import('./.build/poe2-parser.mjs')
await poe2.init('en')
console.error = quiet

const fx = poe2.fixtures
const parse = (item) => {
  const res = poe2.parseClipboard(item.rawText)
  assert.ok(res.isOk(), `parse failed: ${res.isErr() ? res.error : ''}`)
  return res.value
}
const sameRequires = (a, b) => {
  assert.ok(a.requires)
  for (const k of ['level', 'str', 'dex', 'int']) assert.equal(a.requires[k], b.requires?.[k], `requires.${k}`)
}

test('PoE2 parser: data loads', () => {
  assert.ok(poe2.ITEM_BY_REF('ITEM', 'Exalted Orb')?.length)
})

// same checks as EE2's specs/Parser/integration.test.ts and skillGem.test.ts
test('PoE2 parser: bow damage and requirements', () => {
  const it = parse(fx.RareItem)
  for (const f of ['weaponPHYSICAL', 'weaponELEMENTAL', 'weaponAS', 'weaponCRIT']) assert.equal(it[f], fx.RareItem[f], f)
  sameRequires(it, fx.RareItem)
})

test('PoE2 parser: spectre spirit', () => {
  const it = parse(fx.SpectreIncSpirit)
  assert.equal(it.weaponSPIRIT, fx.SpectreIncSpirit.weaponSPIRIT)
  sameRequires(it, fx.SpectreIncSpirit)
})

test('PoE2 parser: armour', () => {
  const it = parse(fx.NormalItem)
  for (const f of ['armourAR', 'armourEV', 'armourES']) assert.equal(it[f], fx.NormalItem[f], f)
  sameRequires(it, fx.NormalItem)
})

test('PoE2 parser: charm quality', () => {
  assert.equal(parse(fx.CharmQuality).quality, fx.CharmQuality.quality)
})

test('PoE2 parser: gems', () => {
  for (const g of [fx.UncutSkillGem, fx.UncutSpiritGem, fx.UncutSupportGem]) {
    const it = parse(g)
    assert.equal(it.category, g.category)
    assert.equal(it.gemLevel, undefined)
  }
  const meta = parse(fx.MetaSkillGem)
  assert.equal(meta.category, fx.MetaSkillGem.category)
  assert.equal(meta.gemLevel, fx.MetaSkillGem.gemLevel)
})

test('PoE2 parser: common item texts parse with their rarity and base', () => {
  const names = ['NormalItem', 'MagicItem', 'RareItem', 'UniqueItem', 'RareWithImplicit', 'HighDamageRareItem',
    'ArmourHighValueRareItem', 'WandRareItem', 'NormalShield', 'TwoImplicitItem', 'RareMap', 'FracturedItem',
    'RequiresOneAttribute', 'NewExplicitTypeDefinitions', 'ItemAllTheModifierTypes', 'UnidentifiedBase',
    'UnidentifiedTier', 'CharmQuality', 'BowThreeAugments']
  for (const n of names) {
    const it = parse(fx[n])
    assert.ok(it.info?.refName, `${n} has no base`)
    assert.ok(it.rarity, `${n} has no rarity`)
  }
  assert.equal(parse(fx.FracturedItem).isFractured, true)
  assert.equal(parse(fx.UniqueItem).rarity, 'Unique')
})

// 0.5.5 entries EE2 had not shipped yet (tools/poe2-additions)
test('PoE2 data: 0.5.5 additions load and a new unique parses', () => {
  assert.equal(poe2.ITEM_BY_REF('UNIQUE', 'Reverie')?.length, 2)
  assert.ok(poe2.ITEM_BY_REF('ITEM', 'Starlit Ore')?.length)
  assert.ok(poe2.STAT_BY_MATCH_STR('# to Level of all Herald Skill Gems'))
  const it = parse({ rawText: `Item Class: Rings
Rarity: Unique
Eshtera's Path
Ring
--------
Item Level: 80
--------
+10% to Fire Resistance
` })
  assert.equal(it.rarity, 'Unique')
  assert.equal(it.info?.refName, "Eshtera's Path")
})

test('PoE2 parser: text that is not an item is refused', () => {
  assert.ok(poe2.parseClipboard('not an item at all').isErr())
})

// A3: trade2 search request built from a parsed PoE2 item (what the Search button sends)
test('PoE2 trade: rare bow becomes a trade2 search with its mods', () => {
  const item = parse(fx.RareItem)
  const { presets, active } = poe2.createPresets(item, {
    league: 'Standard',
    currency: undefined,
    listingType: undefined,
    collapseListings: 'app',
    activateStockFilter: false,
    searchStatRange: 10,
    useEn: true,
    defaultAllSelected: true
  })
  const preset = presets.find(p => p.id === active) ?? presets[0]
  assert.ok(preset.stats.length > 0, 'no stat filters')
  for (const s of preset.stats) s.disabled = false
  const req = poe2.createTradeRequest(preset.filters, preset.stats, item)
  assert.ok(req.query, 'no query')
  assert.equal(req.sort?.price, 'asc')
  const ids = JSON.stringify(req.query.stats)
  assert.match(ids, /"(explicit|implicit|pseudo|rune)\.[a-z_0-9]+"/)
  assert.equal(req.query.filters.type_filters.filters.category.option, 'weapon.bow')
})
