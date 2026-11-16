<template>
  <!-- Deathloom fork: Atlas passive tree (Orbhoarder window). Your atlas builds
       (paste a pathofexile.com / poe.ninja / poeplanner atlas link), what you've
       taken (Client.txt), pan (drag), zoom (wheel), hover for stats, Edit. -->
  <div class="flex flex-col min-h-0 h-full text-sm">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 text-xs shrink-0">
      <select class="rounded bg-gray-800 px-1 max-w-[12rem]" :value="store.active ?? ''" title="Active atlas build" @change="onPick">
        <option value="">No atlas build</option>
        <optgroup v-for="g of groups" :key="g.label" :label="g.label">
          <option v-for="b of g.builds" :key="b.id" :value="b.id">{{ b.name }}</option>
        </optgroup>
      </select>
      <i v-if="synced" class="fas fa-cloud text-gray-600" title="Atlas builds are saved in your builds folder (Atlas) and sync with your builds: friends who can see your builds see them too" />
      <button class="text-gray-400 hover:text-gray-100" title="Add an atlas build from a link or code" @click="importOpen = !importOpen; genOpen = false"><i class="fas fa-file-import" /></button>
      <button class="hover:text-gray-100" :class="genOpen ? 'text-yellow-300' : 'text-gray-400'" title="Ready-made atlas tree: pick the content you farm"
        @click="genOpen = !genOpen; importOpen = false"><i class="fas fa-magic" /></button>
      <template v-if="activeBuild && renaming">
        <input v-model="renameText" class="w-36 px-1 rounded bg-gray-800" spellcheck="false" @keydown.enter="rename" @keydown.esc="renaming = false">
        <button class="text-green-400" title="Save the name" @click="rename"><i class="fas fa-check" /></button>
      </template>
      <template v-else-if="activeBuild && deleting">
        <span class="text-red-300">Delete "{{ activeBuild.name }}"{{ synced ? '' : ' from this PC' }}?</span>
        <button class="px-2 rounded bg-red-700 hover:bg-red-600 text-white" @click="remove">Delete</button>
        <button class="text-gray-400 hover:text-gray-100" @click="deleting = false">Keep</button>
      </template>
      <template v-else-if="activeBuild">
        <span v-if="!activeBuild.own" class="text-gray-500" :title="`${activeBuild.owner}'s atlas build (from build sync): read-only, copy it to change it`"><i class="fas fa-user-friends" /> {{ activeBuild.owner }}</span>
        <button v-if="!activeBuild.own" class="text-gray-400 hover:text-gray-100" title="Copy to your atlas builds (then you can edit it)" @click="copyToMine(activeBuild.id)"><i class="fas fa-copy" /></button>
        <button v-if="activeBuild.own" class="text-gray-400 hover:text-gray-100" title="Rename" @click="renameText = activeBuild.name; renaming = true"><i class="fas fa-i-cursor" /></button>
        <button class="text-gray-400 hover:text-gray-100" title="Copy the atlas tree link (share it with friends)" @click="copyLink"><i class="fas" :class="copied ? 'fa-check text-green-400' : 'fa-link'" /></button>
        <button class="text-gray-400 hover:text-gray-100" title="Open on pathofexile.com (your browser)" @click="openSite"><i class="fas fa-external-link-alt" /></button>
        <button v-if="activeBuild.own" class="text-gray-400 hover:text-red-400" :title="synced ? 'Delete this atlas build (moves to Deleted builds; the next sync removes it on GitHub)' : 'Delete this atlas build (from this PC)'" @click="deleting = true"><i class="fas fa-trash" /></button>
        <span class="text-gray-500">{{ points }} / {{ ATLAS.points ?? '?' }} points</span>
      </template>
      <template v-if="spec">
        <span :title="fromSpec ? 'In both trees: keep these' : undefined"><i class="fas fa-circle text-green-500" /> {{ fromSpec ? 'keep' : 'taken' }} ({{ counts.have }})</span>
        <span><i class="fas fa-circle text-orange-400" /> to take ({{ counts.todo }})</span>
        <button v-if="fromSpec" class="text-red-400 hover:text-red-200" :title="refundTitle" @click="refundListOpen = !refundListOpen">
          <i class="fas fa-circle" /> to remove ({{ refundIds.length }})</button>
        <button v-if="nextIds.length" class="text-cyan-300 hover:text-cyan-100" :title="nextTitle" @click="focusNext">
          <i class="fas fa-crosshairs" /> next {{ nextIds.length }}</button>
      </template>
      <span class="flex-1" />
      <span v-if="searchHits" class="text-yellow-300" :title="searchHits.size ? 'Enter (or click) zooms to the next one' : undefined">
        <button v-if="searchHits.size" class="hover:text-yellow-100" @click="nextHit">{{ hitIdx >= 0 ? `${hitIdx + 1} / ` : '' }}{{ searchHits.size }} found <i class="fas fa-crosshairs" /></button>
        <template v-else>none found</template>
      </span>
      <input v-model="search" class="px-1 rounded bg-gray-800 text-gray-200" :class="compact ? 'w-28' : 'w-36'" placeholder="Search atlas" spellcheck="false"
        @keydown.enter="nextHit" @keydown.esc="search = ''">
      <button v-if="activeBuild?.own" class="hover:text-gray-200" :class="editMode ? 'text-yellow-300' : 'text-gray-500'"
        title="Edit: click a passive to take it (with the path to it) or refund it (with what hangs off it)"
        @click="editMode = !editMode"><i class="fas fa-pen mr-1" />{{ editMode ? 'Editing' : 'Edit' }}</button>
      <button class="text-gray-500 hover:text-gray-200" title="Taken on your atlas: what Orbhoarder saw you allocate in game. Set it here when you already have a tree."
        @click="trackOpen = !trackOpen"><i class="fas fa-check-double" /></button>
      <button class="text-gray-500 hover:text-gray-200" title="Fit the atlas in the window" @click="fit"><i class="fas fa-expand" /></button>
      <button class="hover:text-gray-200" :class="statsOpen ? 'text-yellow-300' : 'text-gray-500'" title="Stats: everything the passives in this build add up to"
        @click="toggleStats"><i class="fas fa-list-ul" /></button>
    </div>

    <div v-if="importOpen" class="flex flex-wrap items-center gap-1 px-2 pb-1 text-xs shrink-0">
      <input v-model="importText" class="flex-1 min-w-[14rem] px-1 rounded bg-gray-800" placeholder="pathofexile.com atlas tree link or code" spellcheck="false" @keydown.enter="doImport">
      <input v-model="importName" class="w-36 px-1 rounded bg-gray-800" placeholder="Name (e.g. Strongbox farm)" spellcheck="false" @keydown.enter="doImport">
      <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" @click="doImport">Add</button>
      <span v-if="importError" class="text-red-400 w-full">{{ importError }}</span>
    </div>
    <div v-if="genOpen" class="px-2 pb-1 text-xs shrink-0">
      <div class="text-gray-400 pb-1">Pick what you farm. Orbhoarder takes that content's notables{{ genSustain ? ' and general map sustain' : '' }} by the shortest path from the start, within the points. Only GGG's own atlas data is used.</div>
      <div class="flex flex-wrap items-center gap-2 pb-1 text-gray-400">
        <label class="flex items-center gap-1" title="Order by what the content's drops sell for now (poe.ninja economy prices)"><input v-model="genByValue" type="checkbox"> Order by what pays</label>
        <span v-if="ninja.isLoading.value && !hasValues" class="text-gray-500">loading prices…</span>
        <span v-else-if="!hasValues" class="text-gray-500">No prices for this league yet (poe.ninja prices trade leagues only).</span>
        <span v-else class="text-gray-500">Price = average of the content's 5 dearest drops now, not profit per map.</span>
        <a :href="NINJA_ATLAS_URL" target="_blank" class="text-gray-400 hover:text-gray-100 underline" title="See which atlas passives players take, on poe.ninja">poe.ninja atlas trees</a>
      </div>
      <div class="flex flex-wrap gap-1 pb-1">
        <button v-for="c of genContents" :key="c.id" class="px-2 rounded"
          :class="genPick.includes(c.id) ? 'bg-yellow-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'"
          :title="contentTitle(c.id)" @click="togglePick(c.id)">{{ c.label }}<span v-if="values[c.id]" class="pl-1 text-yellow-200/80">{{ price(values[c.id].chaos) }}</span></button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1"><input v-model="genSustain" type="checkbox"> Map sustain</label>
        <label class="flex items-center gap-1">Points <input v-model.number="genBudget" type="number" min="10" :max="ATLAS.points ?? 150" class="w-14 px-1 rounded bg-gray-800"></label>
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" :disabled="!genPick.length && !genSustain" @click="doGenerate">Make atlas build</button>
      </div>
      <div v-if="genResult" class="pt-1 text-gray-400">
        Made "{{ genResult.name }}": {{ genResult.points }} points, {{ genResult.notables.length }} notables. It's a normal atlas build: Edit it, copy the link to use it in game.
        <span v-if="genResult.missed.length" class="text-orange-300">Content notables that didn't fit: {{ genResult.missed.join(', ') }}.</span>
        <span v-if="genResult.missedSustain.length" class="text-orange-300">Map sustain that didn't fit: {{ genResult.missedSustain.join(', ') }}.</span>
        <span v-if="genResult.missed.length || genResult.missedSustain.length" class="text-gray-500">More points or fewer contents fits more.</span>
      </div>
    </div>
    <div v-if="lastError" class="px-2 pb-1 text-xs text-red-400 shrink-0">{{ lastError }}</div>
    <div v-if="spec && store.builds.length > 1" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1 text-xs shrink-0">
      <span class="text-gray-400" title="Moving on from another atlas build? Pick it: passives only in that one turn red (remove them: one Orb of Unmaking each), the ones in both stay green">Switching from</span>
      <select class="rounded bg-gray-800 px-1 max-w-[12rem]" :value="fromId ?? ''" @change="setFrom(($event.target as HTMLSelectElement).value || null)">
        <option value="">nothing (show what you took in game)</option>
        <optgroup v-for="g of groups" :key="g.label" :label="g.label">
          <option v-for="b of g.builds.filter(x => x.id !== store.active)" :key="b.id" :value="b.id">{{ b.name }}</option>
        </optgroup>
      </select>
      <span v-if="fromSpec" class="text-gray-500">{{ refundIds.length }} to remove ({{ refundIds.length }} Orb{{ refundIds.length === 1 ? '' : 's' }} of Unmaking), {{ counts.todo }} to take</span>
    </div>
    <div v-if="fromSpec && refundListOpen && refundIds.length" class="px-2 pb-1 text-xs shrink-0 max-h-24 overflow-y-auto">
      <span class="text-gray-400">Remove, outermost first (click to show): </span>
      <button v-for="(id, i) of refundIds" :key="id" class="mr-2 text-red-300 hover:text-red-100" @click="zoomTo([id], 1600, 0.35)">{{ i + 1 }}. {{ ATLAS_BY_ID.get(id)?.[6] || 'Atlas passive' }}</button>
    </div>
    <div v-if="trackOpen" class="px-2 pb-1 text-xs text-gray-400 shrink-0">
      Orbhoarder ticks atlas passives as you allocate them in game (Client.txt). It can't see what you took before, so:
      <button v-if="spec" class="ml-1 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="setTakenFrom(spec.nodes)">I have this whole build</button>
      <button class="ml-1 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="setTakenFrom(null)">I have nothing (respecced / new league)</button>
    </div>
    <div v-if="spec?.unknown" class="px-2 pb-1 text-xs text-gray-500">{{ spec.unknown }} passives in this code aren't on the {{ ATLAS.version }} atlas tree (older or newer tree).</div>
    <div v-if="!store.builds.length && !importOpen && !genOpen" class="px-2 pb-1 text-xs text-gray-500">
      No atlas build yet: press <i class="fas fa-file-import" /> and paste an atlas tree link. Atlas guides (Help tab) link their trees; or start empty with a link to your own tree from pathofexile.com.
    </div>

    <div class="flex flex-1 min-h-0 gap-1">
    <div ref="boxRef" class="relative flex-1 min-w-0 min-h-0 rounded overflow-hidden" :style="{ background: '#1a2232', minHeight: compact ? '12rem' : '20rem' }"
      @wheel.prevent="onWheel" @mousedown="onDown" @mousemove="onMove" @mouseleave="hover = null" @dblclick="fit">
      <canvas ref="canvasRef" class="absolute inset-0" :style="{ cursor: dragging ? 'grabbing' : editMode ? 'pointer' : 'grab' }" />
      <div v-if="hover" class="absolute pointer-events-none z-10 max-w-xs px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs shadow" :style="tipStyle">
        <div class="text-gray-100 font-bold">{{ hover.name }}</div>
        <div v-for="(line, i) of hover.stats" :key="i" class="text-blue-300">{{ line }}</div>
        <div class="pt-px" :class="hover.statusClass">{{ hover.status }}</div>
      </div>
      <!-- multiple-choice notable (edit mode): pick its effect -->
      <div v-if="choiceFor" class="absolute z-20 max-w-xs p-1 rounded bg-gray-800 border border-gray-500 text-xs shadow" :style="choiceStyle" @mousedown.stop>
        <div class="px-1 pb-1 font-bold text-gray-100">{{ choiceFor.name }}</div>
        <button v-for="(e, i) of choiceFor.options" :key="e[0]" class="block w-full text-left px-1 py-0.5 rounded hover:bg-gray-600"
          :class="spec?.choices[String(choiceFor.id)] === e[0] ? 'text-yellow-300' : 'text-blue-300'" @click="choose(choiceFor.id, e[0])">
          {{ i + 1 }}. {{ e[1].join(' ') }}</button>
        <button class="block w-full text-left px-1 py-0.5 rounded hover:bg-gray-600 text-red-400" @click="refund(choiceFor.id); choiceFor = null">Refund</button>
      </div>
    </div>
    <!-- cumulative stats of the build's passives (or of what you took in game) -->
    <div v-if="statsOpen" class="flex flex-col shrink-0 min-h-0 rounded bg-gray-900 text-xs" :class="compact ? 'w-52' : 'w-72'">
      <div class="flex items-center gap-2 px-2 py-1 border-b border-gray-700">
        <button :class="statsOf2 === 'build' ? 'text-gray-100 font-bold' : 'text-gray-500 hover:text-gray-200'" title="Every passive in this atlas build" @click="statsOf2 = 'build'">Build</button>
        <button :class="statsOf2 === 'taken' ? 'text-gray-100 font-bold' : 'text-gray-500 hover:text-gray-200'" title="Only the passives of this build you have taken in game" @click="statsOf2 = 'taken'">Taken</button>
        <span class="flex-1" />
        <span class="text-gray-500">{{ statPoints }} pts</span>
      </div>
      <input v-model="statFilter" class="mx-2 my-1 px-1 rounded bg-gray-800 text-gray-200" placeholder="Filter stats" spellcheck="false">
      <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-1">
        <div v-if="!statLines.length" class="text-gray-500 py-1">{{ statsOf2 === 'taken' ? 'Nothing taken yet (see the ticks button).' : activeBuild ? 'No passives in this build yet.' : 'Pick an atlas build.' }}</div>
        <div v-for="l of statLines" :key="l.text" class="py-px text-blue-300 cursor-pointer hover:text-blue-100"
          :title="l.count > 1 ? `From ${l.count} passives. Click to show them on the atlas` : 'Click to show it on the atlas'" @click="showStat(l.text)">
          {{ l.text }}<span v-if="l.count > 1 && !l.numeric" class="text-gray-500"> ×{{ l.count }}</span>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ATLAS, ATLAS_ADJ, ATLAS_BY_ID, ATLAS_START, atlasUrl, codeFromInput, decodeAtlas, pointsOf, statsOf, type AtlasNode } from './atlas-tree'
import { store, activeBuild, activeSpec as spec, addBuild, setActive, renameBuild, deleteBuild, updateCode, setTakenFrom, takenNodes, taken, synced, lastError, copyToMine, type AtlasBuild } from './atlas-store'
import { sumStats, cleanStat } from './atlas-stats'
import { CONTENTS, CONTENT_NOTABLES, SUSTAIN, generateAtlas, type GenResult } from './atlas-generator'
import { contentValues, NINJA_ATLAS_URL } from './atlas-value'
import { usePoeninja } from '@/web/background/Prices'

const props = defineProps<{ compact?: boolean }>()

// ---- builds ----
const importOpen = ref(false)
const importText = ref('')
const importName = ref('')
const importError = ref('')
const trackOpen = ref(false)
const copied = ref(false)
function onPick (e: Event) {
  const prev = store.value.active
  const next = (e.target as HTMLSelectElement).value || null
  // moving on to another build: show what to remove from the one you had
  if (prev && next && prev !== next) setFrom(prev)
  else if (next && fromId.value === next) setFrom(null)
  setActive(next)
}
function doImport () {
  try {
    const code = codeFromInput(importText.value)
    if (!code) { importError.value = "That doesn't look like an atlas tree link or code."; return }
    addBuild(importName.value, code)
    importText.value = ''; importName.value = ''; importError.value = ''; importOpen.value = false
  } catch (err) { importError.value = (err as Error).message }
}
// yours first, then each friend's (from build sync)
const groups = computed(() => {
  const out: Array<{ label: string, builds: AtlasBuild[] }> = []
  const own = store.value.builds.filter(b => b.own)
  if (own.length) out.push({ label: 'Yours', builds: own })
  const by = new Map<string, AtlasBuild[]>()
  for (const b of store.value.builds) if (!b.own) (by.get(b.owner ?? '?') ?? by.set(b.owner ?? '?', []).get(b.owner ?? '?')!).push(b)
  for (const [owner, builds] of by) out.push({ label: owner, builds })
  return out
})
// ---- stats panel: open by default in the window, closed in the overlay ----
const STATS_KEY = 'deathloom.atlas-stats-open.v1'
function loadStatsOpen (compact: boolean) {
  try { const v = localStorage.getItem(STATS_KEY + (compact ? '.compact' : '')); return v == null ? !compact : v === '1' } catch { return !compact }
}
const statsOpen = ref(loadStatsOpen(!!props.compact))
function toggleStats () {
  statsOpen.value = !statsOpen.value
  try { localStorage.setItem(STATS_KEY + (props.compact ? '.compact' : ''), statsOpen.value ? '1' : '0') } catch {}
}
const statsOf2 = ref<'build' | 'taken'>('build')
const statFilter = ref('')
const statIds = computed<number[]>(() => statsOf2.value === 'taken'
  ? [...haveSet.value].filter(id => !ATLAS_START.has(id))
  : (spec.value?.nodes ?? []))
const statPoints = computed(() => pointsOf(statIds.value))
const statLines = computed(() => {
  const all = sumStats(statIds.value, spec.value?.choices ?? {})
  const q = statFilter.value.trim().toLowerCase()
  return q ? all.filter(l => l.text.toLowerCase().includes(q)) : all
})
// highlight the passives behind a line: search for its words without the numbers
function showStat (text: string) {
  // longest stretch without numbers, so it matches every passive with that wording
  search.value = text.split(/[+-]?\d+(?:\.\d+)?%?/).map(t => t.trim()).sort((a, b) => b.length - a.length)[0] ?? ''
}
// ---- ready-made trees ----
const genOpen = ref(false)
const genPick = ref<string[]>([])
const genSustain = ref(true)
const genBudget = ref<number>(ATLAS.points ?? 150)
const genResult = ref<GenResult | null>(null)
// what pays (poe.ninja economy prices the app already downloads for price checks)
const ninja = usePoeninja()
const VALUE_KEY = 'deathloom.atlas-gen-by-value.v1'
const genByValue = ref((() => { try { return localStorage.getItem(VALUE_KEY) === '1' } catch { return false } })())
watch(genByValue, v => { try { localStorage.setItem(VALUE_KEY, v ? '1' : '0') } catch {} })
watch(genOpen, open => { if (open) ninja.queuePricesFetch() })
const values = computed(() => (ninja.dbVersion.value >= 0 ? contentValues(ninja.allItems()) : {}))
const hasValues = computed(() => Object.keys(values.value).length > 0)
const genContents = computed(() => genByValue.value
  ? [...CONTENTS].sort((a, b) => (values.value[b.id]?.chaos ?? -1) - (values.value[a.id]?.chaos ?? -1))
  : CONTENTS)
function price (chaos: number) {
  const v = ninja.autoCurrency(chaos)
  const n = v.min >= 100 ? Math.round(v.min) : Math.round(v.min * 10) / 10
  return `${n} ${v.currency === 'div' ? 'div' : 'c'}`
}
function contentTitle (id: string) {
  const v = values.value[id]
  const head = `${CONTENT_NOTABLES[id]} notables`
  if (!v) return `${head}\nNo poe.ninja prices for this content's drops.`
  return `${head}\nDearest drops now (poe.ninja):\n` + v.top.map(it => `${it.name}${it.variant ? ` (${it.variant})` : ''}: ${price(it.chaos)}`).join('\n')
}
function togglePick (id: string) {
  genPick.value = genPick.value.includes(id) ? genPick.value.filter(x => x !== id) : [...genPick.value, id]
}
function doGenerate () {
  const r = generateAtlas({ contents: genPick.value, sustain: genSustain.value, budget: Number(genBudget.value) || (ATLAS.points ?? 150) })
  addBuild(r.name, r.code)
  genResult.value = r
}
watch(() => activeBuild.value?.own, (own) => { if (own === false) editMode.value = false })
const renaming = ref(false)
const renameText = ref('')
const deleting = ref(false)
function rename () {
  const b = activeBuild.value
  if (b && renameText.value.trim()) renameBuild(b.id, renameText.value)
  renaming.value = false
}
function remove () {
  const b = activeBuild.value
  if (b) deleteBuild(b.id)
  deleting.value = false
}
async function copyLink () {
  const b = activeBuild.value
  if (!b) return
  try { await navigator.clipboard.writeText(atlasUrl(b.code)); copied.value = true; setTimeout(() => { copied.value = false }, 1500) } catch {}
}
function openSite () { if (activeBuild.value) window.open(atlasUrl(activeBuild.value.code)) }

// ---- state ----
const KIND_RADIUS = [10, 16, 22, 14, 14, 30, 16]
// steps from the start (taken counts go to the nodes nearest the start)
const DEPTH = (() => {
  const d = new Map<number, number>()
  const q = [...ATLAS_START]
  for (const s of q) d.set(s, 0)
  for (let i = 0; i < q.length; i++) {
    for (const nb of ATLAS_ADJ.get(q[i]) ?? []) if (!d.has(nb)) { d.set(nb, d.get(q[i])! + 1); q.push(nb) }
  }
  return d
})()
const buildSet = computed(() => new Set([...(spec.value?.nodes ?? []), ...ATLAS_START]))
// Deathloom fork: "Switching from" another atlas build. Its passives that aren't
// in this one are to remove (red); the ones in both count as taken.
const FROM_KEY = 'deathloom.atlas-from.v1'
const fromId = ref<string | null>((() => { try { return localStorage.getItem(FROM_KEY) } catch { return null } })())
function setFrom (id: string | null) {
  fromId.value = id
  try { if (id) localStorage.setItem(FROM_KEY, id); else localStorage.removeItem(FROM_KEY) } catch {}
}
const fromSpec = computed(() => {
  const b = store.value.builds.find(x => x.id === fromId.value)
  if (!b || b.id === store.value.active) return null
  try { return decodeAtlas(b.code) } catch { return null }
})
const refundListOpen = ref(false)
const refundSet = computed(() => {
  const out = new Set<number>()
  if (!fromSpec.value) return out
  for (const id of fromSpec.value.nodes) {
    if (!buildSet.value.has(id) && !ATLAS_START.has(id) && ATLAS_BY_ID.get(id)?.[3] !== 3) out.add(id)
  }
  return out
})
// outermost first: a passive can only be removed when nothing hangs off it
const refundIds = computed(() => [...refundSet.value].sort((a, b) => (DEPTH.get(b) ?? 0) - (DEPTH.get(a) ?? 0)))
const refundTitle = computed(() => 'Passives of the build you switch from that this one doesn\'t have. Remove them in game (one Orb of Unmaking each), outermost first. Click for the list.')
const haveSet = computed(() => {
  if (!spec.value) return new Set<number>()
  if (fromSpec.value) {
    const from = new Set(fromSpec.value.nodes)
    return new Set([...buildSet.value].filter(id => ATLAS_START.has(id) || from.has(id)))
  }
  return takenNodes([...buildSet.value], DEPTH)
})
const points = computed(() => pointsOf(spec.value?.nodes ?? []))
type State = 'have' | 'todo' | 'none' | 'refund'
function stateOf (id: number): State {
  if (refundSet.value.has(id)) return 'refund'
  if (!buildSet.value.has(id)) return 'none'
  return haveSet.value.has(id) ? 'have' : 'todo'
}
const counts = computed(() => {
  const c = { have: 0, todo: 0 }
  for (const id of buildSet.value) {
    if (ATLAS_START.has(id) || ATLAS_BY_ID.get(id)?.[3] === 3) continue
    c[haveSet.value.has(id) ? 'have' : 'todo']++
  }
  return c
})
// Deathloom fork: next passives to take in game (up to 5): the path to the
// nearest notable of the build (map sustain wins a tie), then the next one
const nextIds = computed<number[]>(() => {
  if (!spec.value) return []
  const have = new Set(haveSet.value)
  const todo = new Set([...buildSet.value].filter(id => !have.has(id) && ATLAS_BY_ID.get(id)?.[3] !== 3))
  const out: number[] = []
  while (out.length < 5 && todo.size) {
    // BFS from what's taken, through the build's untaken passives
    const prev = new Map<number, number>()
    const dist = new Map<number, number>()
    const q = [...have]
    for (const id of q) dist.set(id, 0)
    let best: number | null = null; let bestScore = Infinity; let nearestAny: number | null = null
    for (let i = 0; i < q.length; i++) {
      const cur = q[i]
      for (const nb of ATLAS_ADJ.get(cur) ?? []) {
        if (dist.has(nb) || !todo.has(nb)) continue
        dist.set(nb, dist.get(cur)! + 1); prev.set(nb, cur); q.push(nb)
        nearestAny ??= nb
        const n = ATLAS_BY_ID.get(nb)!
        if (n[3] === 1 || n[3] === 2) {
          const score = dist.get(nb)! - (SUSTAIN.test(n[8].join(' ')) ? 0.5 : 0)
          if (score < bestScore) { bestScore = score; best = nb }
        }
      }
    }
    const target = best ?? nearestAny
    if (target == null) break
    const path: number[] = []
    for (let c: number | undefined = target; c != null && !have.has(c); c = prev.get(c)) path.unshift(c)
    for (const id of path) {
      if (out.length >= 5) break
      out.push(id); have.add(id); todo.delete(id)
    }
  }
  return out
})
const nextIndex = computed(() => new Map(nextIds.value.map((id, i) => [id, i + 1])))
const nextTitle = computed(() => 'Next passives to take in game (numbered on the atlas): the path to the nearest notable, map sustain first. Click to zoom.\n' +
  nextIds.value.map((id, i) => `${i + 1}. ${ATLAS_BY_ID.get(id)?.[6] ?? id}`).join('\n'))
function focusNext () { if (nextIds.value.length) zoomTo(nextIds.value, 1600, 0.3) }
const COLORS: Record<State, string> = { have: '#22c55e', todo: '#fb923c', none: '#5b6b84', refund: '#ef4444' }
const search = ref('')
const searchHits = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q.length < 2) return null
  const hits = new Set<number>()
  for (const n of ATLAS.nodes) {
    if (n[3] === 3) continue
    if (n[6].toLowerCase().includes(q) || statsOf(n, {}).some(l => cleanStat(l).toLowerCase().includes(q))) hits.add(n[0])
  }
  return hits
})
const hitIdx = ref(-1)
watch(search, () => { hitIdx.value = -1 })
const hitList = computed(() => [...(searchHits.value ?? [])].sort((a, b) => (DEPTH.get(a) ?? 0) - (DEPTH.get(b) ?? 0)))
function nextHit () {
  const list = hitList.value
  if (!list.length) return
  hitIdx.value = (hitIdx.value + 1) % list.length
  zoomTo([list[hitIdx.value]], 1400, 0.35)
}

// ---- edit (take with path / refund with what hangs off it) ----
const editMode = ref(false)
function save (nodes: Set<number>, choices: Record<string, number>) {
  const b = activeBuild.value
  if (!b) return
  const keep: Record<string, number> = {}
  for (const [k, v] of Object.entries(choices)) if (nodes.has(Number(k))) keep[k] = v
  updateCode(b.id, { nodes: [...nodes].filter(id => !ATLAS_START.has(id)), choices: keep })
}
function take (id: number) {
  const s = spec.value
  if (!s) return
  const have = new Set([...s.nodes, ...ATLAS_START])
  // shortest path from anything allocated
  const prev = new Map<number, number>()
  const q = [...have]
  const seen = new Set(q)
  let found = false
  for (let i = 0; i < q.length && !found; i++) {
    for (const nb of ATLAS_ADJ.get(q[i]) ?? []) {
      if (seen.has(nb) || ATLAS_BY_ID.get(nb)?.[3] === 3) continue
      seen.add(nb); prev.set(nb, q[i]); q.push(nb)
      if (nb === id) { found = true; break }
    }
  }
  if (!found) return
  for (let c: number | undefined = id; c != null && !have.has(c); c = prev.get(c)) have.add(c)
  const choices = { ...s.choices }
  const v = ATLAS.variants[String(id)]
  if (v && choices[String(id)] == null) choices[String(id)] = v[0][0]
  save(have, choices)
}
function refund (id: number) {
  const s = spec.value
  if (!s || ATLAS_START.has(id)) return
  const left = new Set([...s.nodes, ...ATLAS_START])
  left.delete(id)
  // keep only what's still connected to the start
  const keep = new Set<number>()
  const q = [...ATLAS_START]
  q.forEach(x => keep.add(x))
  for (let i = 0; i < q.length; i++) {
    for (const nb of ATLAS_ADJ.get(q[i]) ?? []) if (left.has(nb) && !keep.has(nb)) { keep.add(nb); q.push(nb) }
  }
  save(keep, s.choices)
}
const choiceFor = shallowRef<null | { id: number, name: string, options: Array<[number, string[]]>, x: number, y: number }>(null)
function choose (id: number, effect: number) {
  const s = spec.value
  if (!s) return
  save(new Set([...s.nodes, ...ATLAS_START]), { ...s.choices, [String(id)]: effect })
  choiceFor.value = null
}
function clickNode (n: AtlasNode, x: number, y: number) {
  if (n[3] === 3 || ATLAS_START.has(n[0])) return
  if (!buildSet.value.has(n[0])) { take(n[0]); return }
  const v = ATLAS.variants[String(n[0])]
  if (v) { choiceFor.value = { id: n[0], name: n[6], options: v, x, y }; return }
  refund(n[0])
}
const choiceStyle = computed(() => {
  const c = choiceFor.value; const box = boxRef.value
  if (!c || !box) return {}
  return { left: `${Math.min(c.x + 8, box.clientWidth - 330)}px`, top: `${Math.min(c.y + 8, box.clientHeight - 160)}px` }
})

// ---- view ----
const boxRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let scale = 0.05
let offX = 0
let offY = 0
let fitted = false
function zoomTo (ids: Iterable<number>, pad: number, maxScale: number) {
  const box = boxRef.value
  if (!box) return
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
  for (const id of ids) {
    const n = ATLAS_BY_ID.get(id)
    if (!n) continue
    minX = Math.min(minX, n[1]); maxX = Math.max(maxX, n[1]); minY = Math.min(minY, n[2]); maxY = Math.max(maxY, n[2])
  }
  if (!isFinite(minX)) return
  const w = box.clientWidth; const h = box.clientHeight
  if (!w || !h) return
  scale = Math.min(maxScale, w / (maxX - minX + pad), h / (maxY - minY + pad))
  offX = w / 2 - (minX + maxX) / 2 * scale
  offY = h / 2 - (minY + maxY) / 2 * scale
  fitted = true
  draw()
}
function fit () { zoomTo(ATLAS.nodes.map(n => n[0]), 400, 1) }
function onWheel (e: WheelEvent) {
  const rect = boxRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const next = Math.min(2, Math.max(0.01, scale * Math.exp(-e.deltaY * 0.0015)))
  offX = mx - (mx - offX) * (next / scale)
  offY = my - (my - offY) * (next / scale)
  scale = next
  draw()
}
const dragging = ref(false)
let dragFrom: { x: number, y: number, offX: number, offY: number } | null = null
let downAt: { x: number, y: number } | null = null
function onDown (e: MouseEvent) {
  if (e.button !== 0) return
  choiceFor.value = null
  downAt = { x: e.clientX, y: e.clientY }
  dragFrom = { x: e.clientX, y: e.clientY, offX, offY }
  dragging.value = true
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onUp, { once: true })
}
function onDragMove (e: MouseEvent) {
  if (!dragFrom) return
  offX = dragFrom.offX + e.clientX - dragFrom.x
  offY = dragFrom.offY + e.clientY - dragFrom.y
  draw()
}
function onUp (e: MouseEvent) {
  if (editMode.value && downAt && Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) < 5) {
    const rect = boxRef.value!.getBoundingClientRect()
    const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
    if (n) clickNode(n, e.clientX - rect.left, e.clientY - rect.top)
  }
  downAt = null; dragFrom = null; dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
}
function nodeAt (mx: number, my: number): AtlasNode | null {
  const wx = (mx - offX) / scale; const wy = (my - offY) / scale
  let best: AtlasNode | null = null
  let bestD = Infinity
  for (const n of ATLAS.nodes) {
    if (n[3] === 3) continue
    const r = Math.max(KIND_RADIUS[n[3]] ?? 10, 6 / scale)
    const d = (n[1] - wx) ** 2 + (n[2] - wy) ** 2
    if (d < r * r && d < bestD) { best = n; bestD = d }
  }
  return best
}

// ---- hover ----
const hover = shallowRef<null | { name: string, stats: string[], status: string, statusClass: string, x: number, y: number }>(null)
const tipStyle = computed(() => {
  const h = hover.value; const box = boxRef.value
  if (!h || !box) return {}
  const left = h.x + 16 + 320 > box.clientWidth ? Math.max(0, h.x - 336) : h.x + 16
  return { left: `${left}px`, top: `${Math.min(h.y + 12, box.clientHeight - 120)}px` }
})
function onMove (e: MouseEvent) {
  if (dragFrom) return
  const rect = boxRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const n = nodeAt(mx, my)
  if (!n) { hover.value = null; return }
  const st = stateOf(n[0])
  const [status, statusClass] = ATLAS_START.has(n[0])
    ? ['Atlas start', 'text-gray-400']
    : st === 'refund' ? ['Remove: only in the build you switch from', 'text-red-400']
      : st === 'have' ? [fromSpec.value ? 'In both builds: keep' : 'You have it', 'text-green-400']
        : nextIndex.value.has(n[0]) ? [`Next: ${nextIndex.value.get(n[0])} of ${nextIds.value.length}`, 'text-cyan-300']
          : st === 'todo' ? ['To take', 'text-orange-400'] : ['', '']
  hover.value = { name: n[6] || 'Atlas passive', stats: statsOf(n, spec.value?.choices ?? {}), status, statusClass, x: mx, y: my }
}

// ---- drawing ----
let raf = 0
function draw () {
  if (raf) return
  raf = requestAnimationFrame(() => { raf = 0; paint() })
}
function linkState (a: number, b: number): State {
  const sa = stateOf(a); const sb = stateOf(b)
  if (sa === 'refund' || sb === 'refund') {
    const from = fromSpec.value?.nodes
    return from && (sa === 'refund' || ATLAS_START.has(a) || from.includes(a)) && (sb === 'refund' || ATLAS_START.has(b) || from.includes(b)) ? 'refund' : 'none'
  }
  if (sa === 'none' || sb === 'none') return 'none'
  return sa === 'have' && sb === 'have' ? 'have' : 'todo'
}
function paint () {
  const canvas = canvasRef.value; const box = boxRef.value
  if (!canvas || !box) return
  const dpr = window.devicePixelRatio || 1
  const w = box.clientWidth; const h = box.clientHeight
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
  }
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY)

  const arcTo = (na: AtlasNode, nb: AtlasNode, cx: number, cy: number) => {
    const r = Math.hypot(na[1] - cx, na[2] - cy)
    const a1 = Math.atan2(na[2] - cy, na[1] - cx)
    const a2 = Math.atan2(nb[2] - cy, nb[1] - cx)
    let d = a2 - a1
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    ctx.moveTo(na[1], na[2])
    ctx.arc(cx, cy, r, a1, a1 + d, d < 0)
  }
  for (const st of ['none', 'refund', 'todo', 'have'] as State[]) {
    ctx.beginPath()
    ctx.strokeStyle = COLORS[st]
    ctx.lineWidth = (st === 'none' ? 3 : 7) / Math.max(scale * 8, 1) * 4
    for (const [a, b] of ATLAS.links) {
      if (linkState(a, b) !== st) continue
      const na = ATLAS_BY_ID.get(a); const nb = ATLAS_BY_ID.get(b)
      if (!na || !nb) continue
      const g = ATLAS.groups[String(na[4])]
      if (na[4] === nb[4] && na[5] === nb[5] && na[5] > 0 && g) arcTo(na, nb, g[0], g[1])
      else { ctx.moveTo(na[1], na[2]); ctx.lineTo(nb[1], nb[2]) }
    }
    for (const [a, b, cx, cy] of ATLAS.arcs) {
      if (linkState(a, b) !== st) continue
      const na = ATLAS_BY_ID.get(a); const nb = ATLAS_BY_ID.get(b)
      if (na && nb) arcTo(na, nb, cx, cy)
    }
    ctx.stroke()
  }

  const hits = searchHits.value
  for (const n of ATLAS.nodes) {
    const kind = n[3]
    const r = KIND_RADIUS[kind] ?? 10
    if (kind === 3) continue // masteries are art labels
    if (kind === 5) {
      ctx.beginPath(); ctx.arc(n[1], n[2], r * 2, 0, Math.PI * 2)
      ctx.strokeStyle = '#7b8aa3'; ctx.lineWidth = 4; ctx.stroke()
      continue
    }
    const st = stateOf(n[0])
    ctx.beginPath(); ctx.arc(n[1], n[2], r, 0, Math.PI * 2)
    ctx.fillStyle = nextIndex.value.has(n[0]) ? '#67e8f9' : st === 'none' ? (kind === 0 ? '#46536a' : '#56647d') : COLORS[st]
    ctx.fill()
    if (kind === 1 || kind === 2) {
      ctx.lineWidth = kind === 2 ? 5 : 3
      ctx.strokeStyle = st === 'none' ? '#a3b1c6' : '#f9fafb'
      ctx.stroke()
    }
  }
  // search: dim the rest, then a bright ring that stays big at any zoom
  if (hits) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = 'rgba(8, 12, 20, 0.6)'
    ctx.fillRect(0, 0, w, h)
    const current = hitIdx.value >= 0 ? hitList.value[hitIdx.value] : null
    for (const id of hits) {
      const n = ATLAS_BY_ID.get(id)
      if (!n) continue
      const x = n[1] * scale + offX; const y = n[2] * scale + offY
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue
      const rr = Math.max((KIND_RADIUS[n[3]] ?? 10) * scale + 4, 7)
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2)
      ctx.fillStyle = '#facc15'; ctx.fill()
      ctx.beginPath(); ctx.arc(x, y, rr + 5, 0, Math.PI * 2)
      ctx.strokeStyle = id === current ? '#ffffff' : 'rgba(250, 204, 21, 0.75)'
      ctx.lineWidth = id === current ? 3 : 2; ctx.stroke()
    }
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY)
  }
  // names: keystones always when big enough, notables when zoomed in; mastery labels when zoomed out a bit
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.textAlign = 'center'
  for (const n of ATLAS.nodes) {
    const show = n[3] === 2 ? scale > 0.05 : n[3] === 1 ? scale > 0.12 : n[3] === 3 ? scale > 0.03 && scale < 0.12 : false
    if (!show) continue
    const x = n[1] * scale + offX; const y = n[2] * scale + offY
    if (x < -60 || y < -20 || x > w + 60 || y > h + 20) continue
    ctx.font = n[3] === 3 ? 'italic 10px sans-serif' : '11px sans-serif'
    ctx.fillStyle = hits?.has(n[0]) ? '#fef08a' : n[3] === 3 ? '#7b8aa3' : stateOf(n[0]) === 'none' ? '#a3b1c6' : '#f3f4f6'
    ctx.fillText(n[6], x, y + (n[3] === 3 ? 0 : (KIND_RADIUS[n[3]] ?? 10) * scale + 12))
  }
  // next passives: numbers above them
  if (nextIndex.value.size) {
    ctx.font = 'bold 12px sans-serif'
    ctx.textBaseline = 'middle'
    for (const [id, i] of nextIndex.value) {
      const n = ATLAS_BY_ID.get(id)
      if (!n) continue
      const x = n[1] * scale + offX; const y = n[2] * scale + offY - (KIND_RADIUS[n[3]] ?? 10) * scale - 12
      ctx.fillStyle = '#0e7490'
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ecfeff'
      ctx.fillText(String(i), x, y + 0.5)
    }
    ctx.textBaseline = 'alphabetic'
  }
}

watch([searchHits, buildSet, haveSet, nextIds, refundSet, hitIdx], () => draw())
watch(() => store.value.active, () => { if (spec.value?.nodes.length) zoomTo(spec.value.nodes, 1200, 0.3); else fit() })
watch(taken, () => draw())
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => { if (fitted) draw(); else fit() })
  if (boxRef.value) ro.observe(boxRef.value)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('mousemove', onDragMove)
  if (raf) cancelAnimationFrame(raf)
})
</script>
