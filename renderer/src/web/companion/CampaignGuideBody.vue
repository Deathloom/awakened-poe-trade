<template>
  <!-- Deathloom fork: campaign guide body (used by the overlay widget and the HUD window) -->
  <div class="widget-default-style text-gray-200 leading-tight text-sm flex flex-col"
    :style="tall ? { width: 'var(--hud-w, 20rem)', height: 'var(--hud-h)' } : { width: 'var(--hud-w, 20rem)' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t">
      <span class="text-gray-500"><i class="fas fa-route mr-1" />Act {{ step.act }}</span>
      <span v-if="areaLevel" class="text-gray-500 text-xs">area level {{ areaLevel }}</span>
      <div class="ml-auto flex gap-x-2 text-gray-500">
        <button class="hover:text-gray-200" title="Previous step" @click="move(-1)"><i class="fas fa-chevron-left" /></button>
        <button class="hover:text-gray-200" title="Next step" @click="move(1)"><i class="fas fa-chevron-right" /></button>
        <button class="hover:text-gray-200" :title="showAll ? 'Show fewer steps' : 'Show the whole act'" @click="showAll = !showAll">
          <i class="fas" :class="showAll ? 'fa-compress-alt' : 'fa-list'" /></button>
        <button class="hover:text-gray-200" title="Start over (new character)" @click="reset"><i class="fas fa-undo" /></button>
      </div>
    </div>
    <div ref="listEl" class="p-1 min-h-0" :class="{ 'overflow-y-auto flex-1': tall }">
      <div v-for="s of visible" :key="s.i" class="flex gap-x-2 px-1 rounded" :data-current="s.i === index ? '1' : undefined"
        :class="s.i === index ? 'bg-gray-800' : (s.i < index ? 'opacity-50' : '')">
        <span class="w-4 shrink-0 text-center">
          <i v-if="s.trial" class="fas fa-dungeon text-yellow-500" title="Labyrinth trial" />
          <i v-else-if="s.optional" class="fas fa-star text-blue-300" title="Optional" />
          <i v-else-if="s.i === index" class="fas fa-map-marker-alt text-green-400" />
        </span>
        <div class="min-w-0">
          <div :class="s.i === index ? 'text-gray-100' : 'text-gray-400'">{{ s.zone }}</div>
          <div v-if="s.note && (s.i === index || showAll || s.i === index + 1)" class="text-xs text-gray-500">{{ s.note }}</div>
        </div>
      </div>
      <div v-if="!lastZone" class="px-1 pt-1 text-xs text-gray-600">
        Follows you on each zone change (from Client.txt). If it doesn't move after you change zones,
        set the Client.txt path in Settings → General.
      </div>
      <div v-if="lastZone && !matched" class="px-1 pt-1 text-xs text-gray-600">
        In "{{ lastZone }}" (not on the route)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from './game-log'
import { STEPS, findStep, isOnRoute, actFromAreaCode } from './campaign-route'

const KEY = 'deathloom.campaign-step.v1'
function loadIndex () {
  try { return Math.min(STEPS.length - 1, Math.max(0, Number(localStorage.getItem(KEY)) || 0)) } catch { return 0 }
}

const index = ref(loadIndex())
const showAll = ref(false)
const lastZone = ref('')
const matched = ref(true)
const areaLevel = ref<number | null>(null)
// act of the zone being entered, from its area id (null = unknown)
let areaAct: number | null = null

function setIndex (i: number) {
  index.value = Math.min(STEPS.length - 1, Math.max(0, i))
  try { localStorage.setItem(KEY, String(index.value)) } catch {}
}

const step = computed(() => STEPS[index.value])

// tall: resized in the HUD; shows the whole act and scrolls to the current step
const props = defineProps<{ tall?: boolean }>()
const listEl = ref<HTMLElement>()

const visible = computed(() => {
  const all = STEPS.map((s, i) => ({ ...s, i }))
  if (showAll.value || props.tall) return all.filter(s => s.act === step.value.act)
  return all.slice(Math.max(0, index.value - 1), index.value + 4)
})

watch([index, () => props.tall], () => {
  if (!props.tall) return
  nextTick(() => {
    listEl.value?.querySelector('[data-current]')?.scrollIntoView({ block: 'center' })
  }).catch(() => {})
}, { immediate: true })

function move (d: number) { setIndex(index.value + d) }
function reset () { setIndex(0); lastZone.value = ''; matched.value = true }

const listener = Host.onEvent('MAIN->CLIENT::game-log', (e) => {
  const lang = AppConfig().language
  for (const line of e.lines) {
    const ev = parseLogLine(line, lang)
    if (!ev) continue
    if (ev.type === 'area') {
      areaLevel.value = ev.level
      areaAct = actFromAreaCode(ev.code)
    }
    if (ev.type === 'zone') {
      lastZone.value = ev.name
      // forward only: back in town or an earlier zone keeps the current step
      const i = findStep(ev.name, index.value, areaAct)
      matched.value = isOnRoute(ev.name)
      if (i >= 0) setIndex(i)
    }
  }
})
onUnmounted(() => { listener.abort() })
</script>
