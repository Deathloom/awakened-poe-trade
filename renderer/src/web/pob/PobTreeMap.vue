<template>
  <!-- Deathloom fork: the whole passive tree (desktop window). The build's loadout
       picked above vs the character: pan (drag), zoom (wheel), hover for stats. -->
  <div class="flex flex-col min-h-0 h-full text-sm">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 text-xs shrink-0">
      <span v-if="alloc" class="text-gray-300">{{ alloc.ascendancy ?? alloc.className }}</span>
      <span v-if="alloc" class="text-gray-500">{{ alloc.points }} points · {{ alloc.ascendancyPoints }} ascendancy</span>
      <template v-if="fromOn">
        <span><i class="fas fa-circle text-green-500" /> keep ({{ counts.both }})</span>
        <span><i class="fas fa-circle text-orange-400" /> to take ({{ counts.build }})</span>
        <button class="text-red-400 hover:text-red-200" title="Passives of the build you switch from that this one doesn't have. Refund them in game (one Orb of Regret each, or refund points), outermost first. Click for the list."
          @click="refundListOpen = !refundListOpen"><i class="fas fa-circle" /> to remove ({{ refundIds.length }})</button>
      </template>
      <template v-else-if="levellingOn && levelPlan">
        <span class="text-gray-400">Levelling: {{ plan?.phases[plan.phase - 1]?.title }}</span>
        <span><i class="fas fa-circle text-green-500" /> taken by now</span>
        <span><i class="fas fa-circle text-cyan-300" /> next ({{ levelPlan.next.length }})</span>
        <span><i class="fas fa-circle text-orange-400" /> later</span>
      </template>
      <template v-else-if="live">
        <span class="text-gray-400">{{ character }}: {{ live.points }} points<template v-if="live.level"> · level {{ live.level }}</template></span>
        <span><i class="fas fa-circle text-green-500" /> have ({{ counts.both }})</span>
        <span><i class="fas fa-circle text-orange-400" /> to take ({{ counts.build }})</span>
        <span><i class="fas fa-circle text-purple-400" /> not in the build ({{ counts.live }})</span>
      </template>
      <span v-else-if="alloc"><i class="fas fa-circle text-yellow-400" /> in the build</span>
      <span class="flex-1" />
      <input v-if="!compact" v-model="search" class="px-1 rounded bg-gray-800 text-gray-200 w-40" placeholder="Search nodes / stats" spellcheck="false">
      <button v-if="levellingOn && levelPlan" class="text-gray-500 hover:text-gray-200" title="Zoom to the next passives" @click="focusNext"><i class="fas fa-crosshairs" /></button>
      <button v-if="!compact" class="hover:text-gray-200" :class="editMode ? 'text-yellow-300' : 'text-gray-500'"
        title="Edit: click a passive to take it (with the path to it) or refund it (with what hangs off it). Saved to the build file; masteries are picked in Path of Building."
        :disabled="editBusy" @click="editMode = !editMode"><i class="fas fa-pen mr-1" />{{ editMode ? 'Editing' : 'Edit' }}</button>
      <span v-if="editError" class="text-red-400">{{ editError }}</span>
      <button class="text-gray-500 hover:text-gray-200" title="Fit the tree in the window" @click="fit"><i class="fas fa-expand" /></button>
      <button class="text-gray-500 hover:text-gray-200" title="Reload (and fetch the character again, rate-limited)"
        :disabled="loading" @click="request(true)"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
    </div>
    <div v-if="error" class="px-2 text-gray-400">{{ error }}</div>
    <div v-else-if="liveError" class="px-2 pb-1 text-xs text-gray-500">{{ liveError }}</div>
    <div v-if="!compact && alloc && otherBuilds.length" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pb-1 text-xs shrink-0">
      <span class="text-gray-400" title="Moving on from another build? Pick it: passives only in that one turn red (refund them: one Orb of Regret each), the ones in both stay green. Fills in by itself when you switch your active build.">Switching from</span>
      <select class="rounded bg-gray-800 px-1 max-w-[16rem]" :value="fromPath ?? ''" @change="setFrom(($event.target as HTMLSelectElement).value || null)">
        <option value="">nothing</option>
        <option v-for="b of otherBuilds" :key="b" :value="b">{{ b.replace(/\.xml$/i, '').replace(/\\/g, '/') }}</option>
      </select>
      <span v-if="fromOn" class="text-gray-500">{{ refundIds.length }} to remove ({{ refundIds.length }} Orb{{ refundIds.length === 1 ? '' : 's' }} of Regret), {{ counts.build }} to take</span>
      <span v-else-if="fromError" class="text-red-400">{{ fromError }}</span>
    </div>
    <div v-if="fromOn && refundListOpen && refundIds.length" class="px-2 pb-1 text-xs shrink-0 max-h-24 overflow-y-auto">
      <span class="text-gray-400">Refund, outermost first (click to show): </span>
      <button v-for="(id, i) of refundIds" :key="id" class="mr-2 text-red-300 hover:text-red-100" @click="zoomTo([id])">{{ i + 1 }}. {{ byId.get(id)?.[6] || 'Passive' }}</button>
    </div>
    <div v-if="!compact && alloc && (alloc.clusterNodes || live?.clusterNodes)" class="px-2 pb-1 text-xs text-gray-600">
      Cluster jewel nodes are not drawn ({{ alloc.clusterNodes }} in the build<template v-if="live">, {{ live.clusterNodes }} on the character</template>).
    </div>
    <div ref="boxRef" class="relative flex-1 min-h-0 rounded overflow-hidden" :style="{ background: '#1a2232', minHeight: compact ? '12rem' : '20rem' }"
      @wheel.prevent="onWheel" @mousedown="onDown" @mousemove="onMove" @mouseleave="hover = null" @dblclick="fit">
      <canvas ref="canvasRef" class="absolute inset-0" :style="{ cursor: dragging ? 'grabbing' : 'grab' }" />
      <div v-if="!layout && loading" class="absolute inset-0 flex items-center justify-center text-gray-500">Loading the tree from Path of Building…</div>
      <div v-if="hover" class="absolute pointer-events-none z-10 max-w-xs px-2 py-1 rounded bg-gray-800 border border-gray-600 text-xs shadow"
        :style="tipStyle">
        <div class="text-gray-100 font-bold">{{ hover.name || 'Passive' }}</div>
        <div v-for="(line, i) of hover.stats" :key="i" class="text-blue-300">{{ line }}</div>
        <div v-if="hover.buildEffect" class="text-purple-300">Build: {{ hover.buildEffect }}</div>
        <div v-if="hover.liveEffect" class="text-purple-300">Yours: {{ hover.liveEffect }}</div>
        <div class="pt-px" :class="hover.statusClass">{{ hover.status }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobTreeAlloc, PobTreeMapLayout, PobTreeMapNode } from '@ipc/types'
import { currentPlan as plan, currentTaken as takenSet, mapHave, treeLayout } from './plan-store'
import { fillTakenPaths } from './taken-paths'

const props = defineProps<{
  // levelling view: colours from the levelling plan (taken / next / later) and
  // zoom to the next passives (Orbhoarder window)
  levelling?: boolean
  // smaller header (All tab)
  compact?: boolean
}>()
const levellingOn = computed(() => props.levelling === true)
import { Host } from '@/web/background/IPC'

const loading = ref(false)
const error = ref<string | null>(null)
const layout = shallowRef<PobTreeMapLayout | null>(null)
const version = ref<string | undefined>(undefined)
const alloc = shallowRef<PobTreeAlloc | undefined>(undefined)
const live = shallowRef<PobTreeAlloc | undefined>(undefined)
const character = ref('Character')
const liveError = ref<string | null>(null)
const search = ref('')
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::pob-tree-map', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  const newVersion = e.version !== version.value
  if (e.layout) {
    layout.value = e.layout
    treeLayout.value = e.layout
    version.value = e.version
  }
  alloc.value = e.alloc
  live.value = e.live
  character.value = e.character ?? 'Character'
  liveError.value = e.liveError ?? null
  // the active build may have changed (Switching from fills in by itself)
  if (!props.compact) requestBuilds()
  if (newVersion || !fitted) {
    if (levellingOn.value && levelPlan.value) focusNext()
    else fit()
  } else draw()
})
const characterListener = Host.onEvent('MAIN->CLIENT::pob-character', () => { request() })

function request (refreshGear = false) {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-tree-map',
    payload: { requestId: lastRequestId, refreshGear, haveVersion: layout.value ? version.value : undefined }
  })
}
defineExpose({ request })
request()

// ---- node state ----
const KIND_RADIUS = [10, 16, 22, 14, 14, 30, 16]

const byId = computed(() => {
  const m = new Map<number, PobTreeMapNode>()
  for (const n of layout.value?.nodes ?? []) m.set(n[0], n)
  return m
})
// ---- Deathloom fork (Gerhard, 16 Nov 2026): "Switching from" another PoB build ----
// Its passives this build doesn't have are to refund (red), the ones in both are
// kept (green), the rest of this build is to take (orange). Read-only: the other
// build file is read by main (pob-compare), nothing is changed.
const FROM_KEY = 'deathloom.pob-tree-from.v1'
const fromSaved = (() => { try { return JSON.parse(localStorage.getItem(FROM_KEY) ?? 'null') ?? {} } catch { return {} } })()
const fromPath = ref<string | null>(typeof fromSaved.from === 'string' ? fromSaved.from : null)
let lastActive: string | null = typeof fromSaved.lastActive === 'string' ? fromSaved.lastActive : null
const buildPaths = ref<string[]>([])
const activePath = ref<string | null>(null)
const otherBuilds = computed(() => buildPaths.value.filter(b => b !== activePath.value))
const fromIds = shallowRef<Set<number> | null>(null)
const fromError = ref('')
const refundListOpen = ref(false)
const fromOn = computed(() => fromIds.value != null && fromPath.value != null && fromPath.value !== activePath.value && alloc.value != null)
function saveFrom () {
  try { localStorage.setItem(FROM_KEY, JSON.stringify({ from: fromPath.value, lastActive })) } catch {}
}
function setFrom (p: string | null) {
  fromPath.value = p
  fromIds.value = null
  fromError.value = ''
  saveFrom()
  loadFrom()
}
let buildsReq = 0
let fromReq = 0
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsReq || !e.ok || !e.list) return
  buildPaths.value = e.list.builds
  const active = e.list.active
  // switched the active build: what you had is what you switch from
  if (active && lastActive && active !== lastActive && e.list.builds.includes(lastActive)) {
    fromPath.value = lastActive
    fromIds.value = null
  }
  if (active) lastActive = active
  activePath.value = active
  if (fromPath.value && !e.list.builds.includes(fromPath.value)) fromPath.value = null
  saveFrom()
  loadFrom()
})
const lsFrom = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
  if (e.requestId !== fromReq) return
  if (!e.ok || !e.a) { fromError.value = e.error ?? 'Could not read that build'; fromIds.value = null; return }
  fromError.value = ''
  fromIds.value = new Set(e.a.tree.nodes)
})
function requestBuilds () {
  buildsReq = ((Date.now() & 0x3ffffff) * 4 + 1) | 0
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsReq } })
}
function loadFrom () {
  if (!fromPath.value || fromPath.value === activePath.value || fromIds.value) return
  fromReq = ((Date.now() & 0x3ffffff) * 4 + 3) | 0
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: fromReq, a: fromPath.value, b: fromPath.value } })
}
if (!props.compact) requestBuilds()
onUnmounted(() => { lsBuilds.abort(); lsFrom.abort() })
// levelling view: "build" = the levelling tree, "live" = what should be taken by now
const levelPlan = computed(() => {
  const p = plan.value
  if (!levellingOn.value || !p || fromOn.value) return null
  const kept = Array.isArray(p.keptIds) ? p.keptIds : []
  const order = p.order.map(n => n.id)
  // taken passives from the game log when known (moves only once you allocate),
  // otherwise the plan's guess from your level
  const taken = takenSet.value
  const done = (i: number) => taken ? taken.has(i) : i < p.taken
  const target = new Set([...kept, ...order])
  let have = new Set([...kept, ...order.filter((_, i) => done(i))])
  // Deathloom fork: the game log only names passives, so a same-named passive
  // taken/refunded off the build can leave a hole. A taken passive cut off from
  // the class start gets the shortest build path back to it (nothing else)
  const lay = layout.value
  if (lay) {
    const starts = lay.nodes.filter(n => n[3] === 5 || n[3] === 6).map(n => n[0])
    // the tree data may not link the class start to its first passives: then the
    // plan's first passive (nearest the start) is where the build's paths begin
    const linked = new Set(lay.links.flat())
    const startLinked = starts.some(id => linked.has(id))
    const roots = startLinked ? starts : [...starts, ...(order.length ? [order[0]] : [])]
    const floating = new Set(lay.nodes.filter(n => n[3] === 3).map(n => n[0]))
    have = fillTakenPaths({ links: lay.links, roots, target, have: [...have], floating })
  }
  return {
    target,
    have,
    next: order.filter(id => !have.has(id)).slice(0, 5)
  }
})
watch(levelPlan, (lp) => { mapHave.value = lp?.have ?? null }, { immediate: true })
const hasLive = computed(() => fromOn.value || levelPlan.value != null || live.value != null)

const refundSet = computed(() => {
  const out = new Set<number>()
  const from = fromIds.value
  if (!fromOn.value || !from) return out
  for (const id of from) {
    const n = byId.value.get(id)
    if (!n || n[3] === 5 || n[3] === 6 || buildSet.value.has(id) || !visibleNode(n)) continue
    out.add(id)
  }
  return out
})
// outermost first: a passive can only be refunded when nothing hangs off it
const refundIds = computed(() => {
  const lay = layout.value; const from = fromIds.value
  if (!lay || !from || !refundSet.value.size) return []
  const adj = new Map<number, number[]>()
  const add = (a: number, b: number) => { const l = adj.get(a); if (l) l.push(b); else adj.set(a, [b]) }
  for (const [a, b] of lay.links) { add(a, b); add(b, a) }
  const starts = lay.nodes.filter(n => n[3] === 5 || n[3] === 6).map(n => n[0])
  const depth = new Map(starts.map(id => [id, 0]))
  const q = [...starts]
  for (let i = 0; i < q.length; i++) {
    for (const nb of adj.get(q[i]) ?? []) {
      if (depth.has(nb) || !from.has(nb)) continue
      depth.set(nb, depth.get(q[i])! + 1); q.push(nb)
    }
  }
  return [...refundSet.value].sort((a, b) => (depth.get(b) ?? 999) - (depth.get(a) ?? 999))
})
// Deathloom fork: mastery effect picked by the build (levelling plan first, else the build's tree), shown on hover
const masteryText = computed(() => {
  const out = new Map<number, string>()
  const lay = layout.value
  if (!lay) return out
  const fromPlan = new Map<number, string>()
  for (const n of plan.value?.order ?? []) if (n.effect) fromPlan.set(n.id, n.effect)
  for (const n of lay.nodes) {
    if (n[3] !== 3 || !buildSet.value.has(n[0])) continue
    const text = fromPlan.get(n[0]) ?? alloc.value?.masteries[String(n[0])]
    if (text) out.set(n[0], text)
  }
  return out
})
const buildSet = computed(() => fromOn.value ? new Set(alloc.value?.ids ?? []) : levelPlan.value?.target ?? new Set(alloc.value?.ids ?? []))
const liveSet = computed(() => {
  const from = fromIds.value
  if (fromOn.value && from) return new Set([...buildSet.value].filter(id => from.has(id)))
  return levelPlan.value?.have ?? new Set(live.value?.ids ?? [])
})
const nextIndex = computed(() => new Map((levelPlan.value?.next ?? []).map((id, i) => [id, i + 1])))

// Only the build's (and the character's) ascendancy is drawn
function visibleNode (n: PobTreeMapNode) {
  const asc = n[7]
  if (!asc) return true
  return asc === alloc.value?.ascendancy || asc === live.value?.ascendancy
}

type State = 'both' | 'build' | 'live' | 'none' | 'refund'
function stateOf (id: number): State {
  if (refundSet.value.has(id)) return 'refund'
  const b = buildSet.value.has(id)
  if (!hasLive.value) return b ? 'build' : 'none'
  const l = liveSet.value.has(id)
  return b && l ? 'both' : b ? 'build' : l ? 'live' : 'none'
}
const counts = computed(() => {
  const c = { both: 0, build: 0, live: 0 }
  for (const n of layout.value?.nodes ?? []) {
    if (n[3] === 5 || n[3] === 6) continue // class / ascendancy starts are free
    const s = stateOf(n[0])
    if (s !== 'none' && s !== 'refund') c[s]++
  }
  return c
})
const COLORS: Record<State, string> = {
  both: '#22c55e',
  build: '#fb923c',
  live: '#c084fc',
  none: '#5b6b84',
  refund: '#ef4444'
}
function color (s: State) {
  return !hasLive.value && s === 'build' ? '#facc15' : COLORS[s]
}

const searchHits = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q.length < 2) return null
  const hits = new Set<number>()
  for (const n of layout.value?.nodes ?? []) {
    if (n[6].toLowerCase().includes(q) || n[8].some(l => l.toLowerCase().includes(q))) hits.add(n[0])
  }
  return hits
})

// ---- view transform ----
const boxRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let scale = 0.05
let offX = 0
let offY = 0
let fitted = false

function bounds () {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
  for (const n of layout.value?.nodes ?? []) {
    if (!visibleNode(n)) continue
    minX = Math.min(minX, n[1]); maxX = Math.max(maxX, n[1])
    minY = Math.min(minY, n[2]); maxY = Math.max(maxY, n[2])
  }
  return { minX, minY, maxX, maxY }
}
function fit () {
  const box = boxRef.value
  if (!box || !layout.value) return
  const b = bounds()
  if (!isFinite(b.minX)) return
  const w = box.clientWidth; const h = box.clientHeight
  scale = Math.min(w / (b.maxX - b.minX + 400), h / (b.maxY - b.minY + 400))
  offX = w / 2 - (b.minX + b.maxX) / 2 * scale
  offY = h / 2 - (b.minY + b.maxY) / 2 * scale
  fitted = true
  draw()
}

// zoom to the next passives of the levelling plan (with what's around them)
function focusNext () {
  const lp = levelPlan.value
  if (!lp) return
  zoomTo(lp.next.length ? lp.next : [...lp.have].slice(-5))
}
function zoomTo (ids: number[]) {
  const box = boxRef.value
  if (!box || !layout.value) return
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
  for (const id of ids) {
    const n = byId.value.get(id)
    if (!n) continue
    minX = Math.min(minX, n[1]); maxX = Math.max(maxX, n[1])
    minY = Math.min(minY, n[2]); maxY = Math.max(maxY, n[2])
  }
  if (!isFinite(minX)) { fit(); return }
  const w = box.clientWidth; const h = box.clientHeight
  const pad = 1600
  scale = Math.min(0.3, w / (maxX - minX + pad), h / (maxY - minY + pad))
  offX = w / 2 - (minX + maxX) / 2 * scale
  offY = h / 2 - (minY + maxY) / 2 * scale
  fitted = true
  draw()
}
watch(() => levelPlan.value?.next.join(','), (now, before) => {
  if (now != null && now !== before && layout.value) focusNext()
})

function onWheel (e: WheelEvent) {
  const rect = boxRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const f = Math.exp(-e.deltaY * 0.0015)
  const next = Math.min(2, Math.max(0.01, scale * f))
  offX = mx - (mx - offX) * (next / scale)
  offY = my - (my - offY) * (next / scale)
  scale = next
  draw()
}
const dragging = ref(false)
let dragFrom: { x: number, y: number, offX: number, offY: number } | null = null
// ---- edit mode (Orbhoarder window): click a passive to take / refund it ----
const editMode = ref(false)
const editBusy = ref(false)
const editError = ref('')
let editReq = 0
const editListener = Host.onEvent('MAIN->CLIENT::pob-edit', (e) => {
  if (e.requestId !== editReq) return
  editBusy.value = false
  editError.value = e.ok ? '' : (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
  if (e.ok) request()
})
onUnmounted(() => { editListener.abort() })
function clickNode (id: number) {
  if (editBusy.value) return
  editBusy.value = true
  editReq = 90_000 + Math.floor(Math.random() * 10_000)
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-edit', payload: { requestId: editReq, ops: [{ op: 'node', id, alloc: !(alloc.value?.ids ?? []).includes(id) }] } })
}
let downAt: { x: number, y: number } | null = null

function onDown (e: MouseEvent) {
  if (e.button !== 0) return
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
  // a click (not a drag) on a passive in edit mode
  if (editMode.value && downAt && Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) < 5 && hover.value?.id != null) {
    clickNode(hover.value.id)
  }
  downAt = null
  dragFrom = null
  dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
}

// ---- hover ----
const hover = shallowRef<null | { id?: number, name: string, stats: string[], status: string, statusClass: string, buildEffect?: string, liveEffect?: string, x: number, y: number }>(null)
const tipStyle = computed(() => {
  const h = hover.value; const box = boxRef.value
  if (!h || !box) return {}
  const left = h.x + 16 + 320 > box.clientWidth ? Math.max(0, h.x - 336) : h.x + 16
  return { left: `${left}px`, top: `${Math.min(h.y + 12, box.clientHeight - 120)}px` }
})
const STATUS_TEXT: Record<State, [string, string]> = {
  both: ['You have it', 'text-green-400'],
  build: ['To take', 'text-orange-400'],
  live: ['Not in the build', 'text-purple-400'],
  none: ['', ''],
  refund: ['Refund: only in the build you switch from', 'text-red-400']
}
function onMove (e: MouseEvent) {
  if (dragFrom || !layout.value) return
  const rect = boxRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left; const my = e.clientY - rect.top
  const wx = (mx - offX) / scale; const wy = (my - offY) / scale
  let best: PobTreeMapNode | null = null
  let bestD = Infinity
  for (const n of layout.value.nodes) {
    if (!visibleNode(n) || n[3] === 5) continue
    const r = Math.max(KIND_RADIUS[n[3]] ?? 10, 6 / scale)
    const d = (n[1] - wx) ** 2 + (n[2] - wy) ** 2
    if (d < r * r && d < bestD) { best = n; bestD = d }
  }
  if (!best) { hover.value = null; return }
  const s = stateOf(best[0])
  const key = String(best[0])
  const status = fromOn.value
    ? (s === 'refund' ? STATUS_TEXT.refund : s === 'both' ? ['In both builds: keep', 'text-green-400'] : s === 'build' ? ['To take', 'text-orange-400'] : ['', ''])
    : levelPlan.value && nextIndex.value.has(best[0])
      ? [`Next: ${nextIndex.value.get(best[0])} of ${levelPlan.value.next.length}`, 'text-cyan-300']
      : levelPlan.value
        ? (s === 'both' ? ['Taken by now', 'text-green-400'] : s === 'build' ? ['Later in this tree', 'text-orange-400'] : ['', ''])
        : !live.value
            ? (s === 'build' ? ['In the build', 'text-yellow-400'] : ['', ''])
            : STATUS_TEXT[s]
  hover.value = {
    id: best[0],
    name: best[6],
    stats: best[8],
    status: status[0],
    statusClass: status[1],
    buildEffect: masteryText.value.get(best[0]) ?? alloc.value?.masteries[key],
    liveEffect: live.value?.masteries[key],
    x: mx,
    y: my
  }
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
    const from = fromIds.value
    const inFrom = (id: number, st: State) => st === 'refund' || from?.has(id) === true || byId.value.get(id)?.[3] === 5
    return inFrom(a, sa) && inFrom(b, sb) ? 'refund' : 'none'
  }
  if (sa === sb) return sa
  // a link is "taken" by whoever has both ends
  const inBuild = buildSet.value.has(a) && buildSet.value.has(b)
  const inLive = liveSet.value.has(a) && liveSet.value.has(b)
  if (!hasLive.value) return inBuild ? 'build' : 'none'
  return inBuild && inLive ? 'both' : inBuild ? 'build' : inLive ? 'live' : 'none'
}
function paint () {
  const canvas = canvasRef.value; const box = boxRef.value; const lay = layout.value
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
  if (!lay) return
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY)
  const nodes = byId.value

  // links: inactive first, allocated on top
  const order: State[] = ['none', 'live', 'refund', 'build', 'both']
  for (const st of order) {
    ctx.beginPath()
    ctx.strokeStyle = color(st)
    ctx.lineWidth = (st === 'none' ? 3 : 7) / Math.max(scale * 8, 1) * 4
    for (const [a, b] of lay.links) {
      const na = nodes.get(a); const nb = nodes.get(b)
      if (!na || !nb || !visibleNode(na) || !visibleNode(nb)) continue
      if (linkState(a, b) !== st) continue
      const g = lay.groups[String(na[4])]
      const r = lay.orbitRadii[na[5]]
      if (na[4] === nb[4] && na[5] === nb[5] && na[5] > 0 && g && r) {
        const a1 = Math.atan2(na[2] - g[1], na[1] - g[0])
        const a2 = Math.atan2(nb[2] - g[1], nb[1] - g[0])
        let d = a2 - a1
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        ctx.moveTo(na[1], na[2])
        ctx.arc(g[0], g[1], r, a1, a1 + d, d < 0)
      } else {
        ctx.moveTo(na[1], na[2])
        ctx.lineTo(nb[1], nb[2])
      }
    }
    ctx.stroke()
  }

  // nodes
  const hits = searchHits.value
  for (const n of lay.nodes) {
    if (!visibleNode(n)) continue
    const kind = n[3]
    const st = stateOf(n[0])
    const r = KIND_RADIUS[kind] ?? 10
    if (kind === 5) {
      ctx.beginPath(); ctx.arc(n[1], n[2], r * 3, 0, Math.PI * 2)
      ctx.strokeStyle = '#7b8aa3'; ctx.lineWidth = 4; ctx.stroke()
      continue
    }
    if (kind === 3 && st === 'none') continue // unallocated masteries are just art
    ctx.beginPath()
    if (kind === 4) {
      ctx.rect(n[1] - r, n[2] - r, r * 2, r * 2)
    } else {
      ctx.arc(n[1], n[2], r, 0, Math.PI * 2)
    }
    const isNext = nextIndex.value.has(n[0])
    ctx.fillStyle = isNext ? '#67e8f9' : st === 'none' ? (kind === 0 ? '#46536a' : '#56647d') : color(st)
    ctx.fill()
    if (kind === 1 || kind === 2) {
      ctx.lineWidth = kind === 2 ? 5 : 3
      ctx.strokeStyle = st === 'none' ? '#a3b1c6' : '#f9fafb'
      ctx.stroke()
    }
    if (isNext) {
      ctx.beginPath(); ctx.arc(n[1], n[2], r + 12, 0, Math.PI * 2)
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 6; ctx.stroke()
    }
    if (hits?.has(n[0])) {
      ctx.beginPath(); ctx.arc(n[1], n[2], r + 14, 0, Math.PI * 2)
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6; ctx.stroke()
    }
  }

  // names of keystones and notables when zoomed in
  if (scale > 0.12) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    for (const n of lay.nodes) {
      if (!visibleNode(n) || (n[3] !== 1 && n[3] !== 2)) continue
      const x = n[1] * scale + offX; const y = n[2] * scale + offY
      if (x < -50 || y < -20 || x > w + 50 || y > h + 20) continue
      ctx.fillStyle = stateOf(n[0]) === 'none' ? '#a3b1c6' : '#f3f4f6'
      ctx.fillText(n[6], x, y + (KIND_RADIUS[n[3]] ?? 10) * scale + 12)
    }
  }
  // numbers on the next passives
  if (nextIndex.value.size) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [id, i] of nextIndex.value) {
      const n = nodes.get(id)
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

watch([searchHits, buildSet, liveSet, nextIndex, refundSet], () => draw())
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => { if (fitted) draw(); else fit() })
  if (boxRef.value) ro.observe(boxRef.value)
})
onUnmounted(() => {
  listener.abort(); characterListener.abort()
  ro?.disconnect()
  window.removeEventListener('mousemove', onDragMove)
  if (raf) cancelAnimationFrame(raf)
})
</script>
