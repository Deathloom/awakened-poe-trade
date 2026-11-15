// Deathloom fork: map mods a build can't run (Build panel → Notes). Each entry is
// lowercase text found in the map mod (English client). Presets use our own
// short labels; `text` is checked against the stat texts the app ships (stats.ndjson).

export interface MapModPreset {
  label: string
  // lowercase text found in the mod (# = any number); also used in the stash search string
  text: string
}

export const MAP_MOD_PRESETS: MapModPreset[] = [
  { label: 'Elemental thorns (reflect)', text: 'elemental thorns' },
  { label: 'Physical thorns (reflect)', text: 'physical thorns' },
  { label: 'No regeneration', text: 'cannot regenerate' },
  { label: 'Less recovery rate', text: 'less recovery' },
  { label: 'Less max resistances', text: 'maximum resistances' },
  { label: "Monsters can't be leeched from", text: 'cannot be leeched' },
  { label: 'Reduced leech recovery', text: 'reduced maximum total' },
  { label: 'Elemental Weakness curse', text: 'elemental weakness' },
  { label: 'Vulnerability curse', text: 'with vulnerability' },
  { label: 'Temporal Chains curse', text: 'temporal chains' },
  { label: 'Enfeeble curse', text: 'with enfeeble' },
  { label: 'Monsters avoid elemental ailments', text: 'avoid elemental ailments' },
  { label: 'Hexproof monsters', text: 'hexproof' },
  { label: 'Less area of effect', text: 'less area of effect' },
  { label: 'Extra monster projectiles', text: 'additional projectiles' },
  { label: 'Monsters steal charges', text: 'steal power' },
  { label: 'Buffs expire faster', text: 'expire #% faster' },
  { label: 'Reduced chance to block', text: 'reduced chance to block' },
  { label: 'Monster action speed floor', text: 'below base value' },
  { label: 'Less accuracy', text: 'less accuracy' },
  { label: 'Reduced non-curse auras', text: 'reduced effect of non-curse' },
  { label: 'Reduced flask charges', text: 'reduced flask charges gained' }
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
