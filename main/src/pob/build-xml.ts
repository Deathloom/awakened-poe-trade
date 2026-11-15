// Deathloom fork (idea 6): read a Path of Building build file (.xml) without
// running PoB, for "Compare builds". Read-only, tolerant: anything it can't
// read is left out. Pure (no fs), so it's unit-tested in tests/.

import type { PobBuildSummary } from '../../../ipc/types'

const ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" }

export function decodeXml (s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|quot|amp|lt|gt|apos);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

function attrs (tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = decodeXml(m[3] ?? m[4] ?? '')
  }
  return out
}

// first <name ...>...</name> (or self-closing) block
function block (xml: string, name: string): { attrs: Record<string, string>, body: string } | null {
  const re = new RegExp(`<${name}(\\s[^>]*?)?(/>|>([\\s\\S]*?)</${name}>)`)
  const m = re.exec(xml)
  return m ? { attrs: attrs(m[1] ?? ''), body: m[3] ?? '' } : null
}

function blocks (xml: string, name: string): Array<{ attrs: Record<string, string>, body: string }> {
  const re = new RegExp(`<${name}(\\s[^>]*?)?(/>|>([\\s\\S]*?)</${name}>)`, 'g')
  return [...xml.matchAll(re)].map(m => ({ attrs: attrs(m[1] ?? ''), body: m[3] ?? '' }))
}

// item header / property lines PoB writes ("Item Level: 84", "Corrupted", …)
const META = /^[A-Za-z][\w ']*:\s*\S/
const FLAGS = /^(Shaper|Elder|Crusader|Redeemer|Hunter|Warlord|Synthesised|Fractured|Searing Exarch|Eater of Worlds) Item$|^(Corrupted|Mirrored|Split|Unidentified|Foulborn)$/i

export interface ParsedItemText { rarity: string, name: string, base: string, mods: string[] }

export function parseItemText (text: string): ParsedItemText {
  const lines = decodeXml(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let rarity = ''
  const r = lines.findIndex(l => /^Rarity:/i.test(l))
  if (r >= 0) rarity = lines[r].replace(/^Rarity:\s*/i, '').trim()
  const rest = r >= 0 ? lines.slice(r + 1) : lines
  const named = /^(rare|unique|relic)$/i.test(rarity)
  const name = rest[0] ?? ''
  const base = named ? (rest[1] ?? '') : name
  const mods: string[] = []
  for (const l of rest.slice(named ? 2 : 1)) {
    if (META.test(l) || FLAGS.test(l)) continue
    // PoB tags: {crafted}{range:0.5}{variant:1,2}{tags:...}
    const t = l.replace(/\{[^}]*\}/g, '').trim()
    if (t && !mods.includes(t)) mods.push(t)
  }
  return { rarity: rarity ? rarity[0].toUpperCase() + rarity.slice(1).toLowerCase() : '', name, base, mods }
}

const MAX_ITEMS = 60
const MAX_GROUPS = 60

export function parseBuildXml (xml: string): PobBuildSummary {
  if (!/<PathOfBuilding[\s>]/.test(xml)) throw new Error('Not a Path of Building build file')
  const b = block(xml, 'Build')
  const stats: Record<string, number> = {}
  for (const s of blocks(b?.body ?? '', 'PlayerStat')) {
    const v = Number(s.attrs.value)
    if (s.attrs.stat && Number.isFinite(v)) stats[s.attrs.stat] = v
  }

  // Gems: active skill set (older builds: skills straight under <Skills>)
  const skillsEl = block(xml, 'Skills')
  let skillXml = skillsEl?.body ?? ''
  const sets = blocks(skillXml, 'SkillSet')
  if (sets.length) {
    const want = skillsEl?.attrs.activeSkillSet ?? '1'
    skillXml = (sets.find(s => s.attrs.id === want) ?? sets[0]).body
  }
  const groups: PobBuildSummary['groups'] = []
  for (const sk of blocks(skillXml, 'Skill').slice(0, MAX_GROUPS)) {
    const gems = blocks(sk.body, 'Gem').map(g => ({
      name: g.attrs.nameSpec || g.attrs.skillId || '',
      level: Number(g.attrs.level) || undefined,
      quality: Number(g.attrs.quality) || undefined,
      enabled: g.attrs.enabled !== 'false'
    })).filter(g => g.name)
    if (!gems.length) continue
    groups.push({ label: sk.attrs.label || undefined, slot: sk.attrs.slot || undefined, enabled: sk.attrs.enabled !== 'false', gems })
  }
  const mainIdx = Number(b?.attrs.mainSocketGroup) - 1
  const mainGroup = groups[mainIdx]

  // Tree: active spec
  const treeEl = block(xml, 'Tree')
  const specs = blocks(treeEl?.body ?? '', 'Spec')
  const spec = specs[(Number(treeEl?.attrs.activeSpec) || 1) - 1] ?? specs[0]
  const nodes = (spec?.attrs.nodes ?? '').split(',').map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0)
  const masteries: Record<string, string> = {}
  for (const m of (spec?.attrs.masteryEffects ?? '').matchAll(/\{(\d+),(\d+)\}/g)) masteries[m[1]] = m[2]

  // Items: active item set's slots
  const itemsEl = block(xml, 'Items')
  const itemText = new Map<string, string>()
  for (const it of blocks(itemsEl?.body ?? '', 'Item')) {
    if (it.attrs.id) itemText.set(it.attrs.id, it.body.replace(/<ModRange[^>]*\/>/g, ''))
  }
  const itemSets = blocks(itemsEl?.body ?? '', 'ItemSet')
  const set = itemSets.find(s => s.attrs.id === itemsEl?.attrs.activeItemSet) ?? itemSets[0]
  const slotEls = set ? blocks(set.body, 'Slot') : blocks(itemsEl?.body ?? '', 'Slot')
  const items: PobBuildSummary['items'] = []
  for (const s of slotEls) {
    const text = itemText.get(s.attrs.itemId ?? '')
    if (!s.attrs.name || !text || s.attrs.itemId === '0') continue
    items.push({ slot: s.attrs.name, ...parseItemText(text) })
    if (items.length >= MAX_ITEMS) break
  }

  return {
    className: b?.attrs.className || undefined,
    ascendancy: b?.attrs.ascendClassName && b.attrs.ascendClassName !== 'None' ? b.attrs.ascendClassName : undefined,
    level: Number(b?.attrs.level) || undefined,
    mainSkill: mainGroup?.gems.find(g => g.enabled)?.name,
    stats,
    groups,
    items,
    tree: { version: spec?.attrs.treeVersion || undefined, nodes, masteries }
  }
}
