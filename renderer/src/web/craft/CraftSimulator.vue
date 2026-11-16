<template>
  <!-- Deathloom fork (16 Nov 2026): crafting simulator. Mod pool and spawn
       weights come from Path of Building's data; the rolling is craft-sim.ts. -->
  <div class="h-full min-h-0 flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
      <label class="craft-field">
        <span>Item type</span>
        <select v-model="type" class="craft-input">
          <option v-for="t of types" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="craft-field min-w-[14rem]">
        <span>Base</span>
        <select v-model="base" class="craft-input">
          <option v-for="b of basesOfType" :key="b.name" :value="b.name">{{ b.name }}{{ b.subType ? ` (${b.subType})` : '' }}</option>
        </select>
      </label>
      <label class="craft-field">
        <span>Item level</span>
        <input v-model.number="ilvl" type="number" min="1" max="100" class="craft-input w-20">
      </label>
      <label v-if="baseInfo?.influences" class="craft-field">
        <span>Influence</span>
        <select v-model="influence1" class="craft-input">
          <option value="">None</option>
          <option v-for="i of INFLUENCES" :key="i.key" :value="i.key">{{ i.label }}</option>
        </select>
      </label>
      <label v-if="baseInfo?.influences && influence1" class="craft-field">
        <span>Second influence</span>
        <select v-model="influence2" class="craft-input">
          <option value="">None</option>
          <option v-for="i of INFLUENCES.filter(x => x.key !== influence1)" :key="i.key" :value="i.key">{{ i.label }}</option>
        </select>
      </label>
    </div>
    <p v-if="error" class="craft-error">{{ error }}</p>

    <div v-if="pool" class="flex-1 min-h-0 flex gap-3">
      <!-- mod pool -->
      <div class="flex-[3] min-w-0 min-h-0 flex flex-col craft-panel">
        <div class="flex items-center gap-2 mb-2">
          <input v-model="filter" class="craft-input flex-1" placeholder="Filter mods (life, resist, spell…)">
          <span class="text-xs text-gray-500 whitespace-nowrap">{{ pool.mods.length }} mods · tick what you want</span>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-x-4">
          <div v-for="side of (['Prefix', 'Suffix'] as const)" :key="side" class="min-w-0">
            <h3 class="craft-heading">{{ side }}es</h3>
            <div v-for="g of groupsOf(side)" :key="g.group" class="craft-mod" :class="{ 'craft-mod-on': wanted[g.group] }">
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" class="mt-1" :checked="Boolean(wanted[g.group])" @change="toggle(g.group)">
                <span class="flex-1 min-w-0">
                  <span class="block text-sm text-gray-200">{{ g.tiers[0].text.join(' / ') }}</span>
                  <span class="block text-xs text-gray-500">{{ g.tiers.length }} tier{{ g.tiers.length > 1 ? 's' : '' }} · {{ share(g) }} of {{ side.toLowerCase() }} rolls{{ g.influence ? ' · ' + g.influence : '' }}</span>
                </span>
              </label>
              <select v-if="wanted[g.group]" v-model.number="wanted[g.group]" class="craft-input mt-1 w-full text-xs">
                <option v-for="(t, i) of g.tiers" :key="t.id" :value="i + 1">T{{ i + 1 }} or better · lvl {{ t.level }} · {{ t.text.join(' / ') }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- method + result -->
      <div class="flex-[2] min-w-[18rem] min-h-0 overflow-y-auto flex flex-col gap-3">
        <div class="craft-panel">
          <h3 class="craft-heading">How to craft</h3>
          <label v-for="m of METHODS" :key="m.key" class="flex items-start gap-2 py-1 cursor-pointer">
            <input v-model="method" type="radio" :value="m.key" class="mt-1">
            <span><span class="text-sm text-gray-200">{{ m.label }}</span><span class="block text-xs text-gray-500">{{ m.help }}</span></span>
          </label>
          <select v-if="method === 'essence'" v-model="essence" class="craft-input w-full mt-1">
            <option value="">Pick an essence…</option>
            <option v-for="e of essences" :key="e.modId" :value="e.modId">{{ e.name }} — {{ e.text.join(' / ') }}</option>
          </select>
          <div class="flex gap-2 mt-3">
            <button class="craft-btn-primary flex-1" :disabled="!wantList.length || running" @click="run(false)"><i class="fas fa-dice mr-1.5" />Simulate</button>
            <button class="craft-btn" :disabled="!wantList.length || running" title="Try every method and sort by cost" @click="run(true)"><i class="fas fa-balance-scale mr-1.5" />Compare all</button>
          </div>
        </div>

        <div v-for="r of results" :key="r.method" class="craft-panel">
          <div class="flex items-baseline gap-2">
            <h3 class="text-sm font-semibold text-gray-100">{{ methodLabel(r.method) }}</h3>
            <span v-if="results.length > 1 && r === results[0] && !r.impossible && r.hits" class="text-xs text-green-400">cheapest</span>
          </div>
          <p v-if="r.impossible" class="text-sm text-yellow-300 mt-1">{{ r.impossible }}</p>
          <template v-else>
            <div class="grid grid-cols-3 gap-2 mt-2 text-center">
              <div><div class="craft-stat">{{ fmtChance(r.chance) }}</div><div class="craft-stat-label">per try</div></div>
              <div><div class="craft-stat">{{ r.hits ? fmtNum(r.attempts) : '—' }}</div><div class="craft-stat-label">tries on average</div></div>
              <div><div class="craft-stat">{{ costText(r) }}</div><div class="craft-stat-label">average cost</div></div>
            </div>
            <ul class="mt-2 text-xs text-gray-400 space-y-0.5">
              <li v-for="(w, i) of wantList" :key="w.group" class="flex justify-between gap-2">
                <span class="truncate">{{ wantLabel(w) }}</span><span class="text-gray-300">{{ fmtChance(r.each[i]) }}</span>
              </li>
            </ul>
            <p v-if="!r.hits" class="text-xs text-yellow-300 mt-2">No hit in {{ r.trials.toLocaleString('en-ZA') }} tries: very unlikely this way.</p>
          </template>
        </div>
        <p class="text-xs text-gray-500">
          Simulated from the game's spawn weights ({{ TRIALS.toLocaleString('en-ZA') }} items per method). Costs use poe.ninja prices for the
          selected league. Not covered yet: fossils, harvest, metacrafts, Eldritch and veiled mods.
        </p>
      </div>
    </div>
    <p v-else-if="!error" class="text-gray-500 text-sm">Loading bases from Path of Building…</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import type { CraftBase, CraftPool, CraftMod } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { usePoeninja } from '@/web/background/Prices'
import { simulate, tiersOf, costPerHit, fmtChance, type Method, type SimResult, type Want } from './craft-sim'
import { pobError } from './pob-error'

const TRIALS = 50_000
const INFLUENCES = [
  { key: 'shaper', label: 'Shaper' }, { key: 'elder', label: 'Elder' }, { key: 'crusader', label: 'Crusader' },
  { key: 'eyrie', label: 'Redeemer' }, { key: 'basilisk', label: 'Hunter' }, { key: 'adjudicator', label: 'Warlord' }
]
const METHODS: Array<{ key: Method, label: string, help: string }> = [
  { key: 'chaos', label: 'Chaos Orb spam', help: 'Reroll the rare until it has everything.' },
  { key: 'alt', label: 'Alteration + Augmentation', help: 'Magic item: at most one prefix and one suffix.' },
  { key: 'altRegal', label: 'Alteration, then Regal', help: 'Alt/Aug for two mods, Regal for a third.' },
  { key: 'essence', label: 'Essence spam', help: 'One mod guaranteed, the rest random.' }
]
const methodLabel = (m: Method) => METHODS.find(x => x.key === m)?.label ?? m

const STORE = 'deathloom.craft.v1'
interface Saved { base?: string, ilvl?: number, method?: Method }
const saved: Saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved } catch { return {} } })()

const bases = shallowRef<CraftBase[]>([])
const type = ref('')
const base = ref(saved.base ?? '')
const ilvl = ref(saved.ilvl ?? 84)
const influence1 = ref('')
const influence2 = ref('')
const pool = shallowRef<CraftPool | null>(null)
const error = ref('')
const filter = ref('')
const wanted = reactive<Record<string, number>>({})
const method = ref<Method>(saved.method ?? 'chaos')
const essence = ref('')
const results = shallowRef<SimResult[]>([])
const running = ref(false)

const types = computed(() => [...new Set(bases.value.map(b => b.type))])
const basesOfType = computed(() => bases.value.filter(b => b.type === type.value))
const baseInfo = computed(() => bases.value.find(b => b.name === base.value))
watch(type, (t) => {
  if (baseInfo.value?.type !== t) base.value = basesOfType.value[basesOfType.value.length - 1]?.name ?? ''
})

let reqId = 0
const listener = Host.onEvent('MAIN->CLIENT::pob-craft', (e) => {
  if (e.requestId !== reqId) return
  if (!e.ok) {
    error.value = pobError(e.error)
    return
  }
  error.value = ''
  if (e.bases) {
    bases.value = e.bases
    const b = e.bases.find(x => x.name === base.value) ?? e.bases.find(x => x.name === 'Vaal Regalia') ?? e.bases[0]
    if (b) { type.value = b.type; base.value = b.name }
  }
  if (e.pool) {
    pool.value = e.pool
    for (const g of Object.keys(wanted)) {
      if (!e.pool.mods.some(m => m.group === g)) wanted[g] = 0
    }
    results.value = []
  }
})
onUnmounted(() => { listener.abort() })
Host.sendEvent({ name: 'CLIENT->MAIN::pob-craft', payload: { requestId: ++reqId } })

let timer: ReturnType<typeof setTimeout> | undefined
watch([base, ilvl, influence1, influence2], () => {
  if (!base.value) return
  if (!baseInfo.value?.influences) { influence1.value = ''; influence2.value = '' }
  if (!influence1.value) influence2.value = ''
  clearTimeout(timer)
  timer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ base: base.value, ilvl: ilvl.value, method: method.value })) } catch {}
    Host.sendEvent({
      name: 'CLIENT->MAIN::pob-craft',
      payload: { requestId: ++reqId, base: base.value, ilvl: Number(ilvl.value) || 84, influences: [influence1.value, influence2.value].filter(Boolean) }
    })
  }, 250)
})

interface Group { group: string, type: 'Prefix' | 'Suffix', tiers: CraftMod[], weight: number, influence?: string }
const groups = computed<Group[]>(() => {
  const p = pool.value
  if (!p) return []
  const map = new Map<string, Group>()
  for (const m of p.mods) {
    let g = map.get(m.group)
    if (!g) { g = { group: m.group, type: m.type, tiers: [], weight: 0 }; map.set(m.group, g) }
    g.tiers.push(m)
    g.weight += m.weight
    if (m.tags.includes('influence_mod')) g.influence = INFLUENCES.find(i => m.affix.toLowerCase().includes(i.label.toLowerCase()))?.label ?? 'influence'
  }
  for (const g of map.values()) g.tiers = tiersOf(g.tiers, g.group) as CraftMod[]
  return [...map.values()].sort((a, b) => b.weight - a.weight)
})
const sideTotal = computed(() => {
  const t = { Prefix: 0, Suffix: 0 }
  for (const g of groups.value) t[g.type] += g.weight
  return t
})
function share (g: Group) {
  const pct = 100 * g.weight / (sideTotal.value[g.type] || 1)
  return pct >= 1 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`
}
function groupsOf (side: 'Prefix' | 'Suffix') {
  const f = filter.value.trim().toLowerCase()
  return groups.value.filter(g => g.type === side && (!f || g.tiers.some(t => t.text.join(' ').toLowerCase().includes(f)) || Boolean(wanted[g.group])))
}
function toggle (group: string) {
  wanted[group] = wanted[group] ? 0 : 1
  results.value = []
}

const essences = computed(() => {
  // best tier of each essence the item level allows
  const best = new Map<string, NonNullable<CraftPool['essences']>[number]>()
  for (const e of pool.value?.essences ?? []) {
    const key = e.name.replace(/^\w+ Essence/, 'Essence')
    if (!best.has(key)) best.set(key, e)
  }
  return [...best.values()]
})

const wantList = computed<Want[]>(() => {
  const list: Want[] = []
  for (const g of groups.value) {
    const tier = wanted[g.group]
    if (tier) list.push({ group: g.group, ids: g.tiers.slice(0, tier).map(t => t.id) })
  }
  return list
})
function wantLabel (w: Want) {
  const g = groups.value.find(x => x.group === w.group)
  return g ? `${g.tiers[0].text.join(' / ')} (T${wanted[g.group]}+)` : w.group
}

function simPool (essenceModId?: string) {
  const p = pool.value!
  const mods = p.mods.map(m => ({ id: m.id, type: m.type, group: m.group, level: m.level, weight: m.weight }))
  const wants = wantList.value.map(w => ({ ...w, ids: [...w.ids] }))
  if (essenceModId) {
    const e = p.essences.find(x => x.modId === essenceModId)
    if (e) {
      mods.push({ id: e.modId, type: e.type, group: e.group, level: 0, weight: 0 })
      // the essence's mod counts when it's in a wanted group (essences give a fixed tier)
      const w = wants.find(x => x.group === e.group)
      if (w) w.ids.push(e.modId)
    }
  }
  return { pool: { mods, maxAffixes: p.maxAffixes }, wants }
}

const ninja = usePoeninja()
function price (name: string): number | undefined {
  return ninja.findPriceByQuery({ ns: 'ITEM', name, variant: undefined })?.chaos
}
function essenceName (id: string) {
  return pool.value?.essences.find(e => e.modId === id)?.name
}
function costText (r: SimResult) {
  const c = costPerHit(r, price, r.method === 'essence' ? essenceName(essence.value) : undefined)
  if (c == null) return r.hits ? '?' : '—'
  return c >= 1000 ? `${fmtNum(c)} c` : `${c.toFixed(c < 10 ? 1 : 0)} c`
}
function fmtNum (n: number) {
  return Math.round(n).toLocaleString('en-ZA')
}

function run (all: boolean) {
  if (!pool.value) return
  running.value = true
  try { localStorage.setItem(STORE, JSON.stringify({ base: base.value, ilvl: ilvl.value, method: method.value })) } catch {}
  // let the button show "busy" before the work starts
  setTimeout(() => {
    const methods: Method[] = all ? (essence.value ? ['chaos', 'alt', 'altRegal', 'essence'] : ['chaos', 'alt', 'altRegal']) : [method.value]
    const out = methods.map(m => {
      const { pool: p, wants } = simPool(m === 'essence' ? essence.value : undefined)
      return simulate(p, wants, { method: m, trials: TRIALS, essenceModId: m === 'essence' ? essence.value : undefined })
    })
    if (all) {
      const key = (r: SimResult) => r.impossible || !r.hits ? Infinity : (costPerHit(r, price, r.method === 'essence' ? essenceName(essence.value) : undefined) ?? r.attempts * 1e6)
      out.sort((a, b) => key(a) - key(b))
    }
    results.value = out
    running.value = false
  }, 20)
}
</script>
