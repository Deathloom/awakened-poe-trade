<template>
  <!-- Deathloom fork: customisable All tab. Columns of stacked panels; drag the
       lines to resize. Edit layout: drag panels by their bar to move them
       (onto a column's edge for a new column), × removes, Add panel adds. -->
  <div class="flex flex-col flex-1 min-h-0">
    <div v-if="editing" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 mx-2 mt-2 rounded bg-blue-900 text-sm shrink-0">
      <i class="fas fa-arrows-alt text-blue-300" />
      <span class="text-blue-100">Drag a panel by its bar to move it. Drop it on the left or right edge of a column for a new column.</span>
      <select class="ml-auto rounded bg-gray-800 px-1 py-0.5" :value="''" @change="onAdd">
        <option value="" disabled>Add panel…</option>
        <option v-for="p of addable" :key="p.id" :value="p.id">{{ p.label }}</option>
        <option v-if="!addable.length" value="none" disabled>All panels are on the All tab</option>
      </select>
      <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" title="Back to the default layout" @click="resetLayout">Reset layout</button>
      <button class="px-3 rounded bg-blue-600 hover:bg-blue-500 text-white" @click="emit('done')">Done</button>
    </div>

    <div ref="rootEl" class="flex flex-1 min-h-0 p-2">
      <template v-for="(c, n) of visCols" :key="colKey(c)">
        <SplitGutter v-if="n > 0" dir="x" reset-label="even out"
          @drag="d => resizeCols(visCols[n - 1], c, d)" @end="saveLayout" @reset="evenCols" />
        <div :ref="el => setColEl(c, el)" class="relative min-w-0 min-h-0 flex flex-col"
          :style="{ flex: `${cols[c].w} 1 0` }">
          <!-- new column drop zones (edit mode) -->
          <template v-if="editing && dragId">
            <div class="drop-edge left-0" :class="{ 'drop-on': over === `e${c}` }"
              @dragover.prevent="over = `e${c}`" @dragleave="leave(`e${c}`)" @drop.prevent="drop({ newCol: c })" />
            <div class="drop-edge right-0" :class="{ 'drop-on': over === `e${c + 1}` }"
              @dragover.prevent="over = `e${c + 1}`" @dragleave="leave(`e${c + 1}`)" @drop.prevent="drop({ newCol: c + 1 })" />
          </template>
          <template v-for="(r, m) of visItems(c)" :key="cols[c].items[r].id">
            <SplitGutter v-if="m > 0" dir="y" reset-label="even out"
              @drag="d => resizeRows(c, visItems(c)[m - 1], r, d)" @end="saveLayout" @reset="evenRows(c)" />
            <div class="relative min-h-0 flex flex-col" :style="{ flex: `${cols[c].items[r].h} 1 0` }">
              <template v-if="editing">
                <div class="flex items-center gap-x-2 px-2 py-0.5 rounded-t bg-gray-700 text-sm cursor-move shrink-0"
                  draggable="true" @dragstart="start($event, cols[c].items[r].id)" @dragend="end">
                  <i class="fas fa-grip-vertical text-gray-400" />
                  <i class="fas" :class="panelDef(cols[c].items[r].id).icon" />
                  <span class="truncate">{{ panelDef(cols[c].items[r].id).label }}</span>
                  <button class="ml-auto text-gray-400 hover:text-red-400" title="Take off the All tab (Add panel brings it back)"
                    @click="removePanel(cols[c].items[r].id)"><i class="fas fa-times" /></button>
                </div>
                <div class="relative flex-1 min-h-0 rounded-b border border-dashed border-gray-600 overflow-hidden">
                  <div class="absolute inset-0 z-10 bg-gray-900/60" />
                  <div v-if="!shownBySettings(cols[c].items[r].id)" class="absolute inset-0 z-20 flex items-center justify-center p-2 text-center text-gray-400 text-sm">
                    Switched off for the window in Settings → Path of Building → Where panels show
                  </div>
                  <!-- drop: top half before, bottom half after -->
                  <div v-if="dragId && dragId !== cols[c].items[r].id" class="absolute inset-x-0 top-0 h-1/2 z-30"
                    :class="{ 'drop-line-top': over === `${c}:${r}` }"
                    @dragover.prevent="over = `${c}:${r}`" @dragleave="leave(`${c}:${r}`)" @drop.prevent="drop({ col: c, index: r })" />
                  <div v-if="dragId && dragId !== cols[c].items[r].id" class="absolute inset-x-0 bottom-0 h-1/2 z-30"
                    :class="{ 'drop-line-bottom': over === `${c}:${r + 1}` }"
                    @dragover.prevent="over = `${c}:${r + 1}`" @dragleave="leave(`${c}:${r + 1}`)" @drop.prevent="drop({ col: c, index: r + 1 })" />
                  <div class="h-full pointer-events-none select-none" :class="wrap(cols[c].items[r].id)"><component :is="body(cols[c].items[r].id)" v-bind="props(cols[c].items[r].id)" /></div>
                </div>
              </template>
              <div v-else class="h-full min-h-0" :class="wrap(cols[c].items[r].id)"><component :is="body(cols[c].items[r].id)" v-bind="props(cols[c].items[r].id)" /></div>
            </div>
          </template>
        </div>
      </template>
      <div v-if="!visCols.length" class="m-auto text-gray-500 text-center">
        No panels to show. Use <b>Edit layout</b> → Add panel, or switch panels back on in
        Settings → Path of Building → Where panels show.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import SplitGutter from './SplitGutter.vue'
import PobGearBody from '../pob/PobGearBody.vue'
import PobTreeMap from '../pob/PobTreeMap.vue'
import LevellingBody from './LevellingBody.vue'
import PlaySessionBody from '../companion/PlaySessionBody.vue'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import MarketHistoryBody from '../market-history/MarketHistoryBody.vue'
import MarketOverview from '../market-history/MarketOverview.vue'
import MarketSearchBody from '../market-search/MarketSearchBody.vue'
import AtlasTreeMap from '../atlas/AtlasTreeMap.vue'
import TradeBoardBody from '../trade-board/TradeBoardBody.vue'
import {
  ALL_PANELS, layout, saveLayout, resetLayout, panelDef, shownBySettings, inLayout,
  removePanel, addPanel, movePanel, resize, useSettingsSync, type AllPanelId, type DropTarget
} from './all-layout'

const propsIn = defineProps<{ editing: boolean }>()
const emit = defineEmits<{ (e: 'done'): void }>()
useSettingsSync()

const BODIES: Record<AllPanelId, Component> = {
  gear: PobGearBody,
  guide: LevellingBody,
  tree: PobTreeMap,
  atlas: AtlasTreeMap,
  trades: TradeCompanionBody,
  market: MarketHistoryBody,
  overview: MarketOverview,
  search: MarketSearchBody,
  session: PlaySessionBody,
  board: TradeBoardBody
}
function body (id: AllPanelId) { return BODIES[id] }
function props (id: AllPanelId): Record<string, unknown> {
  switch (id) {
    case 'gear': return { active: true, desktop: true }
    case 'tree': return { levelling: true, compact: true }
    case 'atlas': return { compact: true }
    case 'trades': return { fill: true }
    case 'board': return { fill: true }
    case 'market': return { active: true, fill: true }
    default: return {}
  }
}

function wrap (id: AllPanelId) { return id === 'tree' || id === 'atlas' ? 'flex flex-col rounded bg-gray-800' : '' }

const cols = computed(() => layout.value.cols)
// in normal mode panels switched off in Settings are left out (and columns
// left empty); in edit mode everything in the layout shows
const visItems = (c: number) => cols.value[c].items.flatMap((it, i) => propsIn.editing || shownBySettings(it.id) ? [i] : [])
const visCols = computed(() => cols.value.flatMap((_, c) => visItems(c).length ? [c] : []))
const colKey = (c: number) => cols.value[c].items.map(it => it.id).join('+')

const rootEl = ref<HTMLElement>()
const colEls = new Map<number, HTMLElement>()
function setColEl (c: number, el: unknown) { if (el) colEls.set(c, el as HTMLElement); else colEls.delete(c) }
function resizeCols (i: number, j: number, d: number) {
  const ws = cols.value.map(c => c.w)
  resize(ws, i, j, d, rootEl.value?.clientWidth ?? 0, visCols.value)
  cols.value.forEach((c, k) => { c.w = ws[k] })
}
function resizeRows (c: number, i: number, j: number, d: number) {
  const items = cols.value[c].items
  const hs = items.map(it => it.h)
  resize(hs, i, j, d, colEls.get(c)?.clientHeight ?? 0, visItems(c))
  items.forEach((it, k) => { it.h = hs[k] })
}

// double-click a line: even sizes for that set (the rest of the layout stays)
function evenCols () {
  const shown = visCols.value
  const total = shown.reduce((a, k) => a + cols.value[k].w, 0)
  for (const k of shown) cols.value[k].w = total / shown.length
  saveLayout()
}
function evenRows (c: number) {
  const items = cols.value[c].items
  const shown = visItems(c)
  const total = shown.reduce((a, k) => a + items[k].h, 0)
  for (const k of shown) items[k].h = total / shown.length
  saveLayout()
}

const addable = computed(() => ALL_PANELS.filter(p => !inLayout(p.id)))
function onAdd (e: Event) {
  const sel = e.target as HTMLSelectElement
  if (sel.value) addPanel(sel.value as AllPanelId)
  sel.value = ''
}

// drag and drop (edit mode)
const dragId = ref<AllPanelId | null>(null)
const over = ref<string | null>(null)
function start (e: DragEvent, id: AllPanelId) {
  dragId.value = id
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function end () { dragId.value = null; over.value = null }
function leave (k: string) { if (over.value === k) over.value = null }
function drop (to: DropTarget) {
  if (dragId.value) movePanel(dragId.value, to)
  end()
}
</script>

<style>
.drop-edge { position: absolute; top: 0; bottom: 0; width: 18%; max-width: 3rem; z-index: 40; }
.drop-edge.drop-on { background: rgba(59, 130, 246, 0.35); border: 2px solid #3b82f6; border-radius: 4px; }
.drop-line-top { border-top: 3px solid #3b82f6; }
.drop-line-bottom { border-bottom: 3px solid #3b82f6; }
</style>
