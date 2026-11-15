// Deathloom fork: map mods a build can't run (Build panel → Notes). Each entry is
// lowercase text found in the map mod (English client). Presets use our own
// short labels; `text` is checked against the stat texts the app ships (stats.ndjson).

export interface MapModPreset {
  label: string
  // lowercase text found in the mod (# = any number); also used in the stash search string
  text: string
  // shorter regex for the stash search (the game allows 50 characters); checked to
  // match only this mod among the map mods in stats.ndjson
  search: string
}

export const MAP_MOD_PRESETS: MapModPreset[] = [
  { label: 'Elemental thorns (reflect)', text: 'elemental thorns', search: 'ntal th' },
  { label: 'Physical thorns (reflect)', text: 'physical thorns', search: 'ical th' },
  { label: 'No regeneration', text: 'cannot regenerate', search: 'not reg' },
  { label: 'Less recovery rate', text: 'less recovery', search: 'ss rec' },
  { label: 'Less max resistances', text: 'maximum resistances', search: 'um res' },
  { label: "Monsters can't be leeched from", text: 'cannot be leeched', search: 'be lee' },
  { label: 'Reduced leech recovery', text: 'reduced maximum total', search: 'reduced max' },
  { label: 'Elemental Weakness curse', text: 'elemental weakness', search: 'l weak' },
  { label: 'Vulnerability curse', text: 'with vulnerability', search: 'vuln' },
  { label: 'Temporal Chains curse', text: 'temporal chains', search: 'poral' },
  { label: 'Enfeeble curse', text: 'with enfeeble', search: 'enfee' },
  { label: 'Monsters avoid elemental ailments', text: 'avoid elemental ailments', search: 'avoid el' },
  { label: 'Hexproof monsters', text: 'hexproof', search: 'hexp' },
  { label: 'Less area of effect', text: 'less area of effect', search: 'ss area' },
  { label: 'Extra monster projectiles', text: 'additional projectiles', search: 'al proj' },
  { label: 'Monsters steal charges', text: 'steal power', search: 'steal p' },
  { label: 'Buffs expire faster', text: 'expire #% faster', search: 'expire \\d+% f' },
  { label: 'Reduced chance to block', text: 'reduced chance to block', search: 'uced chance to b' },
  { label: 'Monster action speed floor', text: 'below base value', search: 'base val' },
  { label: 'Less accuracy', text: 'less accuracy', search: 'ss acc' },
  { label: 'Reduced non-curse auras', text: 'reduced effect of non-curse', search: 'uced eff' },
  { label: 'Reduced flask charges', text: 'reduced flask charges gained', search: 'uced flask charges g' }
]

export function presetLabel (text: string): string {
  return MAP_MOD_PRESETS.find(p => p.text === text)?.label ?? text
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "expire #% faster" -> /expire \d+(?:\.\d+)?% faster/i
export function entryRegex (entry: string): RegExp {
  return new RegExp(entry.split('#').map(escapeRe).join('\\d+(?:\\.\\d+)?'), 'i')
}

// map mod texts (as on the item) the build can't run -> the matching avoid entries
export function badMods (modTexts: string[], avoid: string[]): Array<{ mod: string, entry: string }> {
  const res = avoid.filter(Boolean).map(a => ({ a, re: entryRegex(a) }))
  const out: Array<{ mod: string, entry: string }> = []
  for (const mod of modTexts) {
    const hit = res.find(r => r.re.test(mod))
    if (hit) out.push({ mod, entry: hit.a })
  }
  return out
}
