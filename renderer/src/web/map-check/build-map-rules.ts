// Deathloom fork (Q4): build-aware map mod warnings. Pure: takes the active
// build's profile (PoB's saved stats + gem names, read from the build file by
// main) and a map mod (its stat ref, English and language-independent, and
// its value), says whether the mod is dangerous for this build and why.
// Unit-tested in tests/logic.test.mjs.

import type { BuildMapProfile } from '@ipc/types'

export interface BuildTraits {
  minion: boolean
  // skill used by totems, traps or mines (thorns and melee reflect hit them, not you)
  delivered: boolean
  melee: boolean
  attack: boolean
  spell: boolean
  physical: boolean
  elemental: boolean
  chaos: boolean
  crit: boolean
  // share of the build's damage from ignite / poison + bleed + impale (0..1)
  igniteShare: number
  poisonBleedShare: number
  regen: boolean
  leech: boolean
  block: boolean
  armour: boolean
  cooldown: boolean
  charges: boolean
  usesCurses: boolean
  curseImmune: boolean
  auras: number
  exposure: boolean
  // lowest elemental over-cap (undefined: not saved in the build)
  minOverCap?: number
  res: { fire?: number, cold?: number, lightning?: number, chaos?: number }
  // which hit is the weakest (lowest maximum hit taken)
  weakestHit?: 'Physical' | 'Fire' | 'Cold' | 'Lightning' | 'Chaos'
}

export interface BuildModFlag {
  // true: dangerous for this build; false: known mod, fine for it
  danger: boolean
  reason: string
}

const has = (names: string[], re: RegExp) => names.some(n => re.test(n))

const MINION_RE = /\b(summon|raise|animate|spectre|zombie|skeleton|golem|phantasm|carrion|reaper|dominating blow|absolution|herald of purity|herald of agony|minion)\b/i
const DELIVERED_RE = /\b(totem|ballista|trap|mine)\b/i
const MELEE_RE = /\b(strike|slam|cyclone|lacerate|cleave|reave|sunder|earthquake|earthshatter|boneshatter|smite|bladestorm|blade flurry|perforate|shield charge|shield crush|frost blades|ice crash|infernal blow|glacial hammer|double strike|dual strike|heavy strike|ground slam|tectonic slam|consecrated path|volcanic fissure|sweep|chain hook|charged dash|whirling blades|crushing fist|rage vortex|melee|multistrike|fist of war|ruthless|close combat|pulverise|ancestral call|shockwave)\b/i
const SPELL_HINT_RE = /\b(spell|brand|nova|bolt|ball|storm|arc|spark|fireball|incinerate|blight|essence drain|contagion|bane|soulrend|exsanguinate|reap|vortex|wave|orb|comet|cremation|armageddon|penance|divine ire|righteous fire|discharge|forbidden rite|dark pact|kinetic|cast)\b/i
const ELEMENTAL_RE = /\b(fire|flame|flames|burning|ignite|incinerate|fireball|cold|frost|frostbolt|ice|freeze|freezing|glacial|winter|wintertide|vortex|arc|spark|lightning|storm|shock|elemental|hydrosphere|cremation|scorching|volatile|penance|divine ire|purifying|crackling|righteous|blazing|molten|magma|comet|explosive|conductivity|flammability|frostbite|wrath|anger|hatred|zealotry|trinity|conviction|herald of ash|herald of ice|herald of thunder)\b/i
const PHYSICAL_RE = /\b(physical|brutality|impale|bleed|bleeding|maim|bloodlust|bone|boneshatter|exsanguinate|reap|perforate|lacerate|bladestorm|blade flurry|bladefall|blade blast|blade vortex|splitting steel|lancing steel|shattering steel|pride)\b/i
const CHAOS_RE = /\b(chaos|void manipulation|withering|essence drain|contagion|bane|blight|soulrend|dark pact|forbidden rite|caustic|toxic rain|vile toxins|decay|despair|malevolence)\b/i
const CURSE_GEM_RE = /\b(despair|flammability|frostbite|conductivity|elemental weakness|vulnerability|enfeeble|temporal chains|punishment|assassin's mark|poacher's mark|sniper's mark|warlord's mark|hextouch|curse on hit|blasphemy|impending doom)\b/i
const AURA_GEM_RE = /^(anger|clarity|determination|discipline|grace|haste|hatred|malevolence|precision|pride|purity of (elements|fire|ice|lightning)|vitality|wrath|zealotry|defiance banner|war banner|dread banner)$/i
const EXPOSURE_GEM_RE = /\b(wave of conviction|frost bomb|scorching ray|exposure)\b/i
const CURSE_IMMUNE_RE = /(cannot be cursed|immun\w* to curses|unaffected by curses)/i
const CURSE_ON_HIT_ITEM_RE = /curse enemies with/i

const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined

export function buildTraits (p: BuildMapProfile): BuildTraits {
  const s = p.stats
  const main = p.mainGems.length ? p.mainGems : (p.mainSkill ? [p.mainSkill] : [])
  const all = p.gems
  const stat = (...keys: string[]) => { for (const k of keys) { const v = num(s[k]); if (v != null) return v } return undefined }

  const minion = (stat('ActiveMinionLimit') ?? 0) > 0 || (main[0] != null && MINION_RE.test(main[0]))
  const delivered = stat('TrapThrowingTime', 'MineLayingTime', 'TotemPlacementTime') != null || has(main, DELIVERED_RE)
  // PoB saves Hit Chance only for attacks (and spells against spell block)
  const attack = !minion && (stat('HitChance') != null || has(main, MELEE_RE))
  const melee = !minion && !delivered && has(main, MELEE_RE)
  const spell = !minion && !attack && (stat('TotalDPS') ?? 0) > 0 && (has(main, SPELL_HINT_RE) || !has(main, MELEE_RE))
  const elemental = has(main, ELEMENTAL_RE)
  const chaos = has(main, CHAOS_RE)
  // attacks with nothing elemental or chaos about them hit with their weapon's physical damage
  const physical = has(main, PHYSICAL_RE) || (attack && !elemental && !chaos)

  const total = stat('CombinedDPS', 'FullDPS') ?? ((stat('TotalDPS') ?? 0) + (stat('TotalDotDPS') ?? 0))
  const share = (v?: number) => total > 0 && v != null ? Math.min(1, v / total) : 0
  const igniteShare = share(stat('IgniteDPS'))
  const poisonBleedShare = share((stat('PoisonDPS') ?? 0) + (stat('BleedDPS') ?? 0) + (stat('ImpaleDPS') ?? 0))

  const life = stat('Life') ?? 0
  const es = stat('EnergyShield') ?? 0
  const pct = (v: number | undefined, pool: number) => pool > 1 && v != null ? v / pool : 0
  const regen = pct(stat('LifeRegenRecovery', 'LifeRegen'), life) >= 0.025 || pct(stat('EnergyShieldRegenRecovery', 'EnergyShieldRegen'), es) >= 0.025
  const leech = pct(stat('LifeLeechGainRate'), life) >= 0.05 || pct(stat('EnergyShieldLeechGainRate'), es) >= 0.05

  const block = Math.max(stat('EffectiveBlockChance', 'BlockChance') ?? 0, stat('EffectiveSpellBlockChance', 'SpellBlockChance') ?? 0) >= 30
  const armour = (stat('PhysicalDamageReduction') ?? 0) >= 30 || (stat('Armour') ?? 0) >= 10000
  const cooldown = (stat('Cooldown') ?? 0) > 0
  const charges = (stat('PowerCharges') ?? 0) + (stat('FrenzyCharges') ?? 0) + (stat('EnduranceCharges') ?? 0) >= 3

  const curseImmune = p.itemMods.some(m => CURSE_IMMUNE_RE.test(m))
  const usesCurses = has(all, CURSE_GEM_RE) || p.itemMods.some(m => CURSE_ON_HIT_ITEM_RE.test(m))
  const auras = all.filter(g => AURA_GEM_RE.test(g)).length
  const exposure = has(all, EXPOSURE_GEM_RE) || p.itemMods.some(m => /exposure/i.test(m) && !/cannot/i.test(m))

  const overCaps = ['Fire', 'Cold', 'Lightning'].map(e => stat(`${e}ResistOverCap`)).filter((v): v is number => v != null)
  const minOverCap = overCaps.length === 3 ? Math.min(...overCaps) : undefined

  let weakestHit: BuildTraits['weakestHit']
  let lowest = Infinity
  for (const t of ['Physical', 'Fire', 'Cold', 'Lightning', 'Chaos'] as const) {
    const v = stat(`${t}MaximumHitTaken`)
    if (v != null && v < lowest) { lowest = v; weakestHit = t }
  }

  return {
    minion,
    delivered,
    melee,
    attack,
    spell,
    physical,
    elemental,
    chaos,
    crit: !minion && (stat('CritChance', 'PreEffectiveCritChance') ?? 0) >= 40,
    igniteShare,
    poisonBleedShare,
    regen,
    leech,
    block,
    armour,
    cooldown,
    charges,
    usesCurses,
    curseImmune,
    auras,
    exposure,
    minOverCap,
    res: { fire: stat('FireResist'), cold: stat('ColdResist'), lightning: stat('LightningResist'), chaos: stat('ChaosResist') },
    weakestHit
  }
}

type Rule = (t: BuildTraits, value: number) => BuildModFlag

const flag = (danger: boolean, yes: string, no: string): BuildModFlag => ({ danger, reason: danger ? yes : no })

function curseRule (name: string, effect: string): Rule {
  return (t) => t.curseImmune
    ? { danger: false, reason: `Your gear makes you immune to curses, so ${name} does nothing.` }
    : { danger: true, reason: `You're not immune to curses: ${name} ${effect}.` }
}

function extraAsRule (element: 'fire' | 'cold' | 'lightning'): Rule {
  return (t) => {
    const r = t.res[element]
    return flag(r != null && r < 75,
      `Your ${element} resistance is ${r}% (not capped): the extra ${element} damage hits hard.`,
      `Your ${element} resistance is capped.`)
  }
}

// keyed by the stat ref (English, the same in every client language). value is the
// mod's number as the parser keeps it: relative to the stat's first, non-negated
// wording, which isn't always the ref's ("Players have #% less Armour": 20% less = -20).
export const MAP_MOD_RULES: Record<string, Rule> = {
  'Rare Monsters have Elemental Thorns reflecting # Elemental Damage': (t) =>
    flag(t.melee, 'Thorns hit back when you hit rares in melee, and your main skill is melee.',
      t.minion ? 'Your minions do the hitting; thorns don\'t reach you.' : t.delivered ? 'Your totems, traps or mines do the hitting.' : 'Your main skill isn\'t melee, so thorns don\'t hit back.'),
  'Rare Monsters have Physical Thorns reflecting # Physical Damage': (t) =>
    flag(t.melee, 'Thorns hit back when you hit rares in melee, and your main skill is melee.',
      t.minion ? 'Your minions do the hitting; thorns don\'t reach you.' : t.delivered ? 'Your totems, traps or mines do the hitting.' : 'Your main skill isn\'t melee, so thorns don\'t hit back.'),
  '#% of Melee Physical Damage taken reflected to Attacker': (t) =>
    flag(t.melee && t.physical, 'Your main skill hits in melee with physical damage: some of it comes back to you.',
      t.melee ? 'Your melee damage isn\'t mostly physical.' : 'Your main skill isn\'t a melee hit of your own.'),
  'Players cannot Regenerate Life, Mana or Energy Shield': (t) =>
    flag(t.regen, 'Your build relies on regeneration (life or energy shield).', 'Regeneration isn\'t a big part of your recovery.'),
  'Players have #% less Recovery Rate of Life and Energy Shield': (t, v) =>
    flag(v < 0 && (t.regen || t.leech), 'Your build relies on regeneration or leech; both recover less.', 'You don\'t rely on regeneration or leech.'),
  'Monsters cannot be Leeched from': (t) =>
    flag(t.leech, 'Your build relies on leech.', 'Leech isn\'t a big part of your recovery.'),
  'Players have #% increased Maximum total Life, Mana and Energy Shield Recovery per second from Leech': (t, v) =>
    flag(v < 0 && t.leech, 'Your build relies on leech; it recovers less per second.', 'Leech isn\'t a big part of your recovery.'),
  'Players have #% to all maximum Resistances': (t, v) => {
    if (v >= 0) return { danger: false, reason: 'More maximum resistance only helps.' }
    if (t.minOverCap == null) return { danger: true, reason: 'Your build file has no over-cap numbers, so this may pull your resistances below cap.' }
    return flag(t.minOverCap < -v,
      `Your lowest elemental over-cap is ${t.minOverCap}%: ${-v}% less maximum pulls you below 75% effective.`,
      `Your over-cap (at least ${t.minOverCap}%) covers it.`)
  },
  'Players are Cursed with Elemental Weakness': (t) => {
    if (t.curseImmune) return curseRule('Elemental Weakness', '')(t, 0)
    return flag(t.minOverCap == null || t.minOverCap < 30,
      t.minOverCap == null ? "You're not immune to curses: Elemental Weakness lowers your resistances." : `Your lowest elemental over-cap is ${t.minOverCap}%: Elemental Weakness takes you below cap.`,
      `Your over-cap (at least ${t.minOverCap}%) covers Elemental Weakness.`)
  },
  'Players are Cursed with Vulnerability': (t) => {
    if (t.curseImmune) return curseRule('Vulnerability', '')(t, 0)
    return flag(t.weakestHit == null || t.weakestHit === 'Physical',
      "You're not immune to curses and physical is your weakest hit: Vulnerability makes it worse.",
      `Physical isn't your weakest hit (${t.weakestHit} is).`)
  },
  'Players are Cursed with Temporal Chains': curseRule('Temporal Chains', 'slows you and your recovery'),
  'Players are Cursed with Enfeeble': curseRule('Enfeeble', 'lowers your damage'),
  'Monsters are Hexproof': (t) =>
    flag(t.usesCurses, 'Your build curses enemies; hexproof monsters can\'t be cursed.', 'Your build doesn\'t curse enemies.'),
  'Monsters have #% chance to Avoid Elemental Ailments': (t) =>
    flag(t.igniteShare >= 0.3, `About ${Math.round(t.igniteShare * 100)}% of your damage is ignite.`, 'Your damage doesn\'t rely on ignite.'),
  'Monsters have a #% chance to avoid Poison, Impale, and Bleeding': (t) =>
    flag(t.poisonBleedShare >= 0.3, `About ${Math.round(t.poisonBleedShare * 100)}% of your damage is poison, bleed or impale.`, 'Your damage doesn\'t rely on poison, bleed or impale.'),
  'Monsters take #% reduced Extra Damage from Critical Strikes': (t, v) =>
    flag(v > 0 && t.crit, 'Your build is a crit build; crits do less.', 'Your build doesn\'t rely on crits.'),
  'Players have #% more Accuracy Rating': (t, v) =>
    flag(v < 0 && t.attack, 'Your main skill is an attack: less accuracy means more misses.', 'Your main skill isn\'t one of your own attacks.'),
  'Monsters have +#% Chance to Block Attack Damage': (t) =>
    flag(t.attack, 'Your main skill is an attack; monsters block some of it.', 'Your main skill isn\'t one of your own attacks.'),
  'Monsters have +#% chance to Suppress Spell Damage': (t) =>
    flag(t.spell, 'Your main skill is a spell; suppressed hits do half damage.', 'Your main skill isn\'t one of your own spells.'),
  '+#% Monster Elemental Resistances': (t) =>
    flag(t.elemental, 'Your main skill deals elemental damage.', 'Your main skill doesn\'t deal much elemental damage.'),
  '+#% Monster Physical Damage Reduction': (t) =>
    flag(t.physical && !t.minion, 'Your main skill hits with physical damage.', 'Your main skill doesn\'t hit with physical damage of your own.'),
  '+#% Monster Chaos Resistance': (t) =>
    flag(t.chaos || t.poisonBleedShare >= 0.3, 'Your damage is chaos or poison.', 'Your damage isn\'t chaos or poison.'),
  'Players have #% reduced Chance to Block': (t, v) =>
    flag(v < 0 && t.block, 'Your build relies on block.', 'Block isn\'t a big part of your defence.'),
  'Players have #% less Armour': (t, v) =>
    flag(v < 0 && t.armour, 'Your build relies on armour.', 'Armour isn\'t a big part of your defence.'),
  'Players have #% more Cooldown Recovery Rate': (t, v) =>
    flag(v < 0 && t.cooldown, 'Your main skill has a cooldown.', 'Your main skill has no cooldown.'),
  'Monsters have #% chance to steal Power, Frenzy and Endurance charges on Hit': (t) =>
    flag(t.charges, 'Your build uses charges.', 'Your build doesn\'t use many charges.'),
  'Players have #% increased effect of Non-Curse Auras from Skills': (t, v) =>
    flag(v < 0 && t.auras >= 2, `Your build runs ${t.auras} auras.`, 'Your build runs few auras.'),
  'Players cannot inflict Exposure': (t) =>
    flag(t.exposure, 'Your build applies exposure.', 'Your build doesn\'t apply exposure.'),
  'Monsters gain #% of their Physical Damage as Extra Chaos Damage': (t) => {
    const r = t.res.chaos
    return flag(r != null && r < 0, `Your chaos resistance is ${r}%.`, 'Your chaos resistance is fine.')
  },
  'Monsters deal #% extra Physical Damage as Fire': extraAsRule('fire'),
  'Monsters deal #% extra Physical Damage as Cold': extraAsRule('cold'),
  'Monsters deal #% extra Physical Damage as Lightning': extraAsRule('lightning')
}

// null: the rules don't know this mod (shown greyed as "doesn't affect your build")
export function checkMapMod (ref: string, value: number | undefined, traits: BuildTraits): BuildModFlag | null {
  const rule = MAP_MOD_RULES[ref]
  return rule ? rule(traits, value ?? 0) : null
}

// one line about the build for the legend
export function describeTraits (t: BuildTraits): string {
  const parts = [
    t.minion ? 'minions' : t.delivered ? 'totems / traps / mines' : t.melee ? 'melee' : t.attack ? 'attacks' : t.spell ? 'spells' : null,
    [t.physical && 'physical', t.elemental && 'elemental', t.chaos && 'chaos'].filter(Boolean).join(' + ') || null,
    t.crit ? 'crit' : null,
    t.igniteShare >= 0.3 ? 'ignite' : null,
    t.poisonBleedShare >= 0.3 ? 'poison / bleed' : null,
    t.regen ? 'regen' : null,
    t.leech ? 'leech' : null,
    t.curseImmune ? 'curse immune' : null
  ].filter(Boolean)
  return parts.join(', ')
}
