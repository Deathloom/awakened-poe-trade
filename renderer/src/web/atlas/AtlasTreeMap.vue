<template>
  <!-- Deathloom fork: Atlas passive tree (Loot Goblin window). Your atlas builds
       (paste a pathofexile.com / poe.ninja / poeplanner atlas link), what you've
       taken (Client.txt), pan (drag), zoom (wheel), hover for stats, Edit. -->
  <div class="flex flex-col min-h-0 h-full text-sm">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 text-xs shrink-0">
      <select class="rounded bg-gray-800 px-1 max-w-[12rem]" :value="store.active ?? ''" title="Active atlas build" @change="onPick">
        <option value="">No atlas build</option>
        <option v-for="b of store.builds" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <button class="text-gray-400 hover:text-gray-100" title="Add an atlas build from a link or code" @click="importOpen = !importOpen"><i class="fas fa-file-import" /></button>
      <template v-if="activeBuild && renaming">
        <input v-model="renameText" class="w-36 px-1 rounded bg-gray-800" spellcheck="false" @keydown.enter="rename" @keydown.esc="renaming = false">
        <button class="text-green-400" title="Save the name" @click="rename"><i class="fas fa-check" /></button>
      </template>
      <template v-else-if="activeBuild && deleting">
        <span class="text-red-300">Delete "{{ activeBuild.name }}" from this PC?</span>
        <button class="px-2 rounded bg-red-700 hover:bg-red-600 text-white" @click="remove">Delete</button>
        <button class="text-gray-400 hover:text-gray-100" @click="deleting = false">Keep</button>
      </template>
      <template v-else-if="activeBuild">
        <button class="text-gray-400 hover:text-gray-100" title="Rename" @click="renameText = activeBuild.name; renaming = true"><i class="fas fa-i-cursor" /></button>
        <button class="text-gray-400 hover:text-gray-100" title="Copy the atlas tree link (share it with friends)" @click="copyLink"><i class="fas" :class="copied ? 'fa-check text-green-400' : 'fa-link'" /></button>
        <button class="text-gray-400 hover:text-gray-100" title="Open on pathofexile.com (your browser)" @click="openSite"><i class="fas fa-external-link-alt" /></button>
        <button class="text-gray-400 hover:text-red-400" title="Delete this atlas build (from this PC)" @click="deleting = true"><i class="fas fa-trash" /></button>
        <span class="text-gray-500">{{ points }} / {{ ATLAS.points ?? '?' }} points</span>
      </template>
      <template v-if="spec">
        <span><i class="fas fa-circle text-green-500" /> taken ({{ counts.have }})</span>
        <span><i class="fas fa-circle text-orange-400" /> to take ({{ counts.todo }})</span>
      </template>
      <span class="flex-1" />
      <input v-if="!compact" v-model="search" class="px-1 rounded bg-gray-800 text-gray-200 w-36" placeholder="Search atlas" spellcheck="false">
      <button v-if="activeBuild && !compact" class="hover:text-gray-200" :class="editMode ? 'text-yellow-300' : 'text-gray-500'"
        title="Edit: click a passive to take it (with the path to it) or refund it (with what hangs off it)"
        @click="editMode = !editMode"><i class="fas fa-pen mr-1" />{{ editMode ? 'Editing' : 'Edit' }}</button>
      <button class="text-gray-500 hover:text-gray-200" title="Taken on your atlas: what Loot Goblin saw you allocate in game. Set it here when you already have a tree."
        @click="trackOpen = !trackOpen"><i class="fas fa-check-double" /></button>
      <button class="text-gray-500 hover:text-gray-200" title="Fit the atlas in the window" @click="fit"><i class="fas fa-expand" /></button>
    </div>

    <div v-if="importOpen" class="flex flex-wrap items-center gap-1 px-2 pb-1 text-xs shrink-0">
      <input v-model="importText" class="flex-1 min-w-[14rem] px-1 rounded bg-gray-800" placeholder="pathofexile.com atlas tree link or code" spellcheck="false" @keydown.enter="doImport">
      <input v-model="importName" class="w-36 px-1 rounded bg-gray-800" placeholder="Name (e.g. Strongbox farm)" spellcheck="false" @keydown.enter="doImport">
      <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" @click="doImport">Add</button>
      <span v-if="importError" class="text-red-400 w-full">{{ importError }}</span>
    </div>
    <div v-if="trackOpen" class="px-2 pb-1 text-xs text-gray-400 shrink-0">
      Loot Goblin ticks atlas passives as you allocate them in game (Client.txt). It can't see what you took before, so:
      <button v-if="spec" class="ml-1 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="setTakenFrom(spec.nodes)">I have this whole build</button>
      <button class="ml-1 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="setTakenFrom(null)">I have nothing (respecced / new league)</button>
    </div>
    <div v-if="spec?.unknown" class="px-2 pb-1 text-xs text-gray-500">{{ spec.unknown }} passives in this code aren't on the {{ ATLAS.version }} atlas tree (older or newer tree).</div>
    <div v-if="!store.builds.length && !importOpen" class="px-2 pb-1 text-xs text-gray-500">
      No atlas build yet: press <i class="fas fa-file-import" /> and paste an atlas tree link. Atlas guides (Help tab) link their trees; or start empty with a link to your own tree from pathofexile.com.
    </div>

    <div ref="boxRef" class="relative flex-1 min-h-0 rounded overflow-hidden" :style="{ background: '#1a2232', minHeight: compact ? '12rem' : '20rem' }"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ATLAS, ATLAS_ADJ, ATLAS_BY_ID, ATLAS_START, atlasUrl, codeFromInput, pointsOf, statsOf, type AtlasNode } from './atlas-tree'
import { store, activeBuild, activeSpec as spec, addBuild, setActive, renameBuild, deleteBuild, updateCode, setTakenFrom, takenNodes, taken } from './atlas-store'

defineProps<{ compact?: boolean }>()

// ---- builds ----
const importOpen = ref(false)
const importText = ref('')
const importName = ref('')
const importError = ref('')
const trackOpen = ref(false)
const copied = ref(false)
function onPick (e: Event) { setActive((e.target as HTMLSelectElement).value || null) }
function doImport () {
  try {
    const code = codeFromInput(importText.value)
    if (!code) { importError.value = "That doesn't look like an atlas tree link or code."; return }
    addBuild(importName.value, code)
    importText.value = ''; importName.value = ''; importError.value = ''; importOpen.value = false
  } catch (err) { importError.value = (err as Error).message }
}
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
const haveSet = computed(() => spec.value ? takenNodes([...buildSet.value], DEPTH) : new Set<number>())
const points = computed(() => pointsOf(spec.value?.nodes ?? []))
type State = 'have' | 'todo' | 'none'
function stateOf (id: number): State {
  if (!buildSet.value.has(id)) return 'none'
  return haveSet.value.has(id) ? 'have' : 'todo'
}
const counts = computed(() => {
  const c = { have: 0, todo: 0 }
  for (const id of buildSet.value) {
    if (ATLAS_START.has(id) || ATLAS_BY_ID.get(id)?.[3] === 3) continue
    c[stateOf(id) === 'have' ? 'have' : 'todo']++
  }
  return c
})
const COLORS: Record<State, string> = { have: '#22c55e', todo: '#fb923c', none: '#5b6b84' }
const search = ref('')
const searchHits = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (q.length < 2) return null
  const hits = new Set<number>()
  for (const n of ATLAS.nodes) {
    if (n[3] === 3) continue
    if (n[6].toLowerCase().includes(q) || statsOf(n, {}).some(l => l.toLowerCase().includes(q))) hits.add(n[0])
  }
  return hits
})

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
    : st === 'have' ? ['You have it', 'text-green-400'] : st === 'todo' ? ['To take', 'text-orange-400'] : ['', '']
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
  for (const st of ['none', 'todo', 'have'] as State[]) {
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
    ctx.fillStyle = st === 'none' ? (kind === 0 ? '#46536a' : '#56647d') : COLORS[st]
    ctx.fill()
    if (kind === 1 || kind === 2) {
      ctx.lineWidth = kind === 2 ? 5 : 3
      ctx.strokeStyle = st === 'none' ? '#a3b1c6' : '#f9fafb'
      ctx.stroke()
    }
    if (hits?.has(n[0])) {
      ctx.beginPath(); ctx.arc(n[1], n[2], r + 14, 0, Math.PI * 2)
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6; ctx.stroke()
    }
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
    ctx.fillStyle = n[3] === 3 ? '#7b8aa3' : stateOf(n[0]) === 'none' ? '#a3b1c6' : '#f3f4f6'
    ctx.fillText(n[6], x, y + (n[3] === 3 ? 0 : (KIND_RADIUS[n[3]] ?? 10) * scale + 12))
  }
}

watch([searchHits, buildSet, haveSet], () => draw())
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
