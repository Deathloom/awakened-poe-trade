<template>
  <!-- Deathloom fork: the whole passive tree (desktop window). The build's loadout
       picked above vs the character: pan (drag), zoom (wheel), hover for stats. -->
  <div class="flex flex-col min-h-0 h-full text-sm">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 text-xs shrink-0">
      <span v-if="alloc" class="text-gray-300">{{ alloc.ascendancy ?? alloc.className }}</span>
      <span v-if="alloc" class="text-gray-500">{{ alloc.points }} points · {{ alloc.ascendancyPoints }} ascendancy</span>
      <template v-if="live">
        <span class="text-gray-400">{{ character }}: {{ live.points }} points<template v-if="live.level"> · level {{ live.level }}</template></span>
        <span><i class="fas fa-circle text-green-500" /> have ({{ counts.both }})</span>
        <span><i class="fas fa-circle text-orange-400" /> to take ({{ counts.build }})</span>
        <span><i class="fas fa-circle text-purple-400" /> not in the build ({{ counts.live }})</span>
      </template>
      <span v-else-if="alloc"><i class="fas fa-circle text-yellow-400" /> in the build</span>
      <span class="flex-1" />
      <input v-model="search" class="px-1 rounded bg-gray-800 text-gray-200 w-40" placeholder="Search nodes / stats" spellcheck="false">
      <button class="text-gray-500 hover:text-gray-200" title="Fit the tree in the window" @click="fit"><i class="fas fa-expand" /></button>
      <button class="text-gray-500 hover:text-gray-200" title="Reload (and fetch the character again, rate-limited)"
        :disabled="loading" @click="request(true)"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
    </div>
    <div v-if="error" class="px-2 text-gray-400">{{ error }}</div>
    <div v-else-if="liveError" class="px-2 pb-1 text-xs text-gray-500">{{ liveError }}</div>
    <div v-if="alloc && (alloc.clusterNodes || live?.clusterNodes)" class="px-2 pb-1 text-xs text-gray-600">
      Cluster jewel nodes are not drawn ({{ alloc.clusterNodes }} in the build<template v-if="live">, {{ live.clusterNodes }} on the character</template>).
    </div>
    <div ref="boxRef" class="relative flex-1 min-h-0 rounded overflow-hidden" style="background: #0b0f17; min-height: 20rem;"
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
    version.value = e.version
  }
  alloc.value = e.alloc
  live.value = e.live
  character.value = e.character ?? 'Character'
  liveError.value = e.liveError ?? null
  if (newVersion || !fitted) fit()
  else draw()
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
const buildSet = computed(() => new Set(alloc.value?.ids ?? []))
const liveSet = computed(() => new Set(live.value?.ids ?? []))

// Only the build's (and the character's) ascendancy is drawn
function visibleNode (n: PobTreeMapNode) {
  const asc = n[7]
  if (!asc) return true
  return asc === alloc.value?.ascendancy || asc === live.value?.ascendancy
}

type State = 'both' | 'build' | 'live' | 'none'
function stateOf (id: number): State {
  const b = buildSet.value.has(id)
  if (!live.value) return b ? 'build' : 'none'
  const l = liveSet.value.has(id)
  return b && l ? 'both' : b ? 'build' : l ? 'live' : 'none'
}
const counts = computed(() => {
  const c = { both: 0, build: 0, live: 0 }
  for (const n of layout.value?.nodes ?? []) {
    if (n[3] === 5 || n[3] === 6) continue // class / ascendancy starts are free
    const s = stateOf(n[0])
    if (s !== 'none') c[s]++
  }
  return c
})
const COLORS: Record<State, string> = {
  both: '#22c55e',
  build: '#fb923c',
  live: '#c084fc',
  none: '#374151'
}
function color (s: State) {
  return !live.value && s === 'build' ? '#facc15' : COLORS[s]
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
function onDown (e: MouseEvent) {
  if (e.button !== 0) return
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
function onUp () {
  dragFrom = null
  dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
}

// ---- hover ----
const hover = shallowRef<null | { name: string, stats: string[], status: string, statusClass: string, buildEffect?: string, liveEffect?: string, x: number, y: number }>(null)
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
  none: ['', '']
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
  const status = !live.value
    ? (s === 'build' ? ['In the build', 'text-yellow-400'] : ['', ''])
    : STATUS_TEXT[s]
  hover.value = {
    name: best[6],
    stats: best[8],
    status: status[0],
    statusClass: status[1],
    buildEffect: alloc.value?.masteries[key],
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
  if (sa === sb) return sa
  // a link is "taken" by whoever has both ends
  const inBuild = buildSet.value.has(a) && buildSet.value.has(b)
  const inLive = liveSet.value.has(a) && liveSet.value.has(b)
  if (!live.value) return inBuild ? 'build' : 'none'
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
  const order: State[] = ['none', 'live', 'build', 'both']
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
      ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 4; ctx.stroke()
      continue
    }
    if (kind === 3 && st === 'none') continue // unallocated masteries are just art
    ctx.beginPath()
    if (kind === 4) {
      ctx.rect(n[1] - r, n[2] - r, r * 2, r * 2)
    } else {
      ctx.arc(n[1], n[2], r, 0, Math.PI * 2)
    }
    ctx.fillStyle = st === 'none' ? (kind === 0 ? '#1f2937' : '#2d3748') : color(st)
    ctx.fill()
    if (kind === 1 || kind === 2) {
      ctx.lineWidth = kind === 2 ? 5 : 3
      ctx.strokeStyle = st === 'none' ? '#6b7280' : '#f9fafb'
      ctx.stroke()
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
      ctx.fillStyle = stateOf(n[0]) === 'none' ? '#6b7280' : '#e5e7eb'
      ctx.fillText(n[6], x, y + (KIND_RADIUS[n[3]] ?? 10) * scale + 12)
    }
  }
}

watch([searchHits, buildSet, liveSet], () => draw())
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
