<template>
  <!-- Deathloom fork: Path of Building build impact panel -->
  <div v-if="visible" class="p-2 border border-gray-600 rounded mb-4 leading-tight">
    <div class="flex items-baseline gap-x-2 mb-1">
      <span class="text-gray-500 shrink-0"><i class="fas fa-hammer mr-1"></i>PoB</span>
      <span v-if="build" class="text-gray-400 truncate" :title="buildTitle">{{ buildTitle }}</span>
      <i v-if="loading" class="fas fa-circle-notch fa-spin text-gray-500 ml-auto"></i>
    </div>

    <div v-if="error" class="text-gray-500 text-sm">{{ error }}</div>

    <template v-else-if="result">
      <div v-if="result.equipped || result.equippedError" class="flex items-center gap-x-1 mb-1 text-sm">
        <button v-for="m of modes" :key="m.key"
          class="px-1 rounded" :class="mode === m.key ? 'bg-gray-700 text-gray-200' : 'text-gray-500'"
          :disabled="m.key === 'equipped' && !result.equipped"
          @click="setMode(m.key)">{{ m.label }}</button>
        <span v-if="mode === 'equipped' && equippedInfo" class="text-gray-500 truncate ml-1" :title="equippedTitle">{{ equippedTitle }}</span>
        <button v-if="liveGearOn" class="text-gray-500 ml-auto" title="Refresh equipped gear (rate-limited)"
          :disabled="loading" @click="refreshGear"><i class="fas fa-sync-alt"></i></button>
      </div>
      <div v-if="result.equippedError" class="text-gray-500 text-sm mb-1">{{ result.equippedError }}</div>
      <template v-if="mode === 'equipped' && equippedInfo">
        <div v-if="equippedInfo.skills && equippedInfo.mainSkillMatched === false" class="text-yellow-500 text-sm mb-1">
          The build's main skill{{ build?.mainSkill ? ` (${build.mainSkill})` : '' }} isn't on your character; using {{ equippedInfo.mainSkill ?? "PoB's guess" }}.
        </div>
        <div v-if="equippedInfo.passivesError" class="text-gray-500 text-sm mb-1">{{ equippedInfo.passivesError }} (using the build's tree)</div>
      </template>

      <div v-if="!shownList.length && !shownLines.length" class="text-gray-500 text-sm">
        {{ mode === 'equipped' ? 'No change for your character.' : 'No change to your build.' }}
      </div>

      <div v-for="(cmp, idx) of shownCompares" :key="idx" :class="{ 'mt-2 pt-2 border-t border-gray-700': idx > 0 }">
        <div class="text-gray-400 text-sm whitespace-pre-line">{{ cmp.header }}</div>
        <div v-if="cmp.summary.length" class="flex flex-wrap gap-1 mt-1">
          <span v-for="s of cmp.summary" :key="s.stat"
            class="px-1 rounded bg-gray-900 text-sm"
            :class="isGood(s) ? 'text-green-400' : 'text-red-400'">
            {{ formatDiff(s.diff, s.stat) }} {{ s.label }}<template v-if="s.pct != null && Math.abs(s.pct) >= 0.1"> ({{ formatPct(s.pct) }})</template>
          </span>
        </div>
        <div v-else-if="!cmp.lines.length" class="text-gray-500 text-sm mt-1">No change.</div>
        <button v-if="cmp.lines.length" class="text-gray-500 text-sm mt-1" @click="toggle(idx)">
          {{ expanded[idx] ? 'Hide details' : `All changes (${cmp.lines.length})` }}
        </button>
        <div v-if="expanded[idx]" class="mt-1 text-sm">
          <div v-for="(line, li) of cmp.lines" :key="li"
            :class="line.positive ? 'text-green-400' : line.negative ? 'text-red-400' : 'text-gray-400'">
            {{ line.text }}
          </div>
        </div>
      </div>

      <button v-if="shownList.length > 1" class="text-gray-500 text-sm mt-2" @click="showAllSlots = !showAllSlots">
        {{ showAllSlots ? 'Best slot only' : `Other slots (${shownList.length - 1})` }}
      </button>

      <div v-for="(line, li) of shownLines" :key="'l' + mode + li" class="text-sm text-gray-400">{{ line.text }}</div>

      <div v-if="mode === 'equipped' && equippedInfo && equippedInfo.summary.length" class="mt-2 pt-2 border-t border-gray-700">
        <button class="text-gray-500 text-sm" @click="showGearVsBuild = !showGearVsBuild">
          {{ showGearVsBuild ? 'Hide' : 'Show' }} your character vs the PoB build
        </button>
        <div v-if="showGearVsBuild" class="flex flex-wrap gap-1 mt-1">
          <span v-for="s of equippedInfo.summary" :key="'g' + s.stat"
            class="px-1 rounded bg-gray-900 text-sm"
            :class="isGood(s) ? 'text-green-400' : 'text-red-400'">
            {{ formatDiff(s.diff, s.stat) }} {{ s.label }}<template v-if="s.pct != null && Math.abs(s.pct) >= 0.1"> ({{ formatPct(s.pct) }})</template>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { PobBuildInfo, PobImpactResult, PobImpactCompare } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { ParsedItem, ItemRarity } from '@/parser'

const props = defineProps<{
  item: ParsedItem
}>()

// "lower is better" isn't needed for the summary stats: more of each is better
type SummaryStat = PobImpactCompare['summary'][number]

let lastRequestId = 0

const loading = ref(false)
const error = ref<string | null>(null)
const hidden = ref(false)
const build = ref<PobBuildInfo | null>(null)
const result = ref<PobImpactResult | null>(null)
const expanded = ref<Record<number, boolean>>({})
const showAllSlots = ref(false)

const enabled = computed(() => AppConfig().pob?.enabled === true)
const visible = computed(() => enabled.value && !hidden.value && isEquipment(props.item))

const buildTitle = computed(() => {
  const b = build.value
  if (!b) return ''
  const extra = [b.ascendancy ?? b.className, b.mainSkill].filter(Boolean).join(', ')
  return extra ? `${b.name} (${extra})` : b.name
})

// Which gear the item is compared against. Remembered while the overlay runs.
type Mode = 'build' | 'equipped'
const modes: Array<{ key: Mode, label: string }> = [
  { key: 'build', label: 'vs build gear' },
  { key: 'equipped', label: 'vs character' }
]
const preferredMode = ref<Mode>('equipped')
const showGearVsBuild = ref(false)

const liveGearOn = computed(() => AppConfig().pob?.liveGear === true)

const mode = computed<Mode>(() =>
  preferredMode.value === 'equipped' && result.value?.equipped ? 'equipped' : 'build')

const shownList = computed(() => {
  const r = result.value
  if (!r) return []
  return mode.value === 'equipped' ? (r.equipped?.compares ?? []) : r.compares
})

const shownLines = computed(() => {
  const r = result.value
  if (!r) return []
  return mode.value === 'equipped' ? (r.equipped?.lines ?? []) : r.lines
})

const shownCompares = computed(() =>
  showAllSlots.value ? shownList.value : shownList.value.slice(0, 1))

const equippedInfo = computed(() => result.value?.equipped?.info ?? null)

const equippedTitle = computed(() => {
  const info = equippedInfo.value
  if (!info) return ''
  const who = [info.character, info.level ? `lvl ${info.level}` : null].filter(Boolean).join(' ')
  const age = info.fetchedAt ? formatAge(Date.now() - info.fetchedAt) : ''
  const what = info.tree || info.skills
    ? [info.tree && 'tree', info.skills && 'gems'].filter(Boolean).join(' + ') + ' + items'
    : 'items only'
  const skipped = info.skipped.length ? ` · skipped: ${info.skipped.join(', ')}` : ''
  return [who, what, age].filter(Boolean).join(' · ') + skipped
})

function setMode (m: Mode) {
  preferredMode.value = m
  expanded.value = {}
  showAllSlots.value = false
}

function isEquipment (item: ParsedItem) {
  if (item.rawText === 'VIRTUAL_ITEM') return false
  if (!Object.values(ItemRarity).includes(item.rarity as ItemRarity)) return false
  // Let PoB decide the rest; non-gear is hidden when PoB can't place it
  return true
}

const listener = Host.onEvent('MAIN->CLIENT::pob-impact', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (e.ok) {
    build.value = e.build ?? null
    result.value = e.result ?? null
    error.value = null
  } else {
    result.value = null
    const msg = e.error ?? 'Unknown error'
    // Currency, maps, gems etc.: nothing to show
    if (msg.includes("doesn't recognise this item's base type")) {
      hidden.value = true
    } else {
      error.value = msg.replace(/^.*ImpactServer\.lua:\d+: /, '')
    }
  }
})
onUnmounted(() => { listener.abort() })

function request (refreshGear: boolean) {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-impact',
    payload: { requestId: lastRequestId, itemText: props.item.rawText, refreshGear }
  })
}

watch(() => [props.item, enabled.value] as const, ([item]) => {
  expanded.value = {}
  showAllSlots.value = false
  showGearVsBuild.value = false
  hidden.value = false
  result.value = null
  error.value = null
  if (!enabled.value || !isEquipment(item)) return
  request(false)
}, { immediate: true })

function refreshGear () {
  request(true)
}

function formatAge (ms: number) {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

function toggle (idx: number) {
  expanded.value[idx] = !expanded.value[idx]
}

function isGood (s: SummaryStat) {
  return s.diff > 0
}

function formatDiff (diff: number, stat: string) {
  const sign = diff > 0 ? '+' : '-'
  const abs = Math.abs(diff)
  const isRes = stat.endsWith('Resist')
  let text: string
  if (abs >= 1e6) text = `${(abs / 1e6).toFixed(2)}M`
  else if (abs >= 1e4) text = `${(abs / 1e3).toFixed(1)}k`
  else if (abs >= 100 || Number.isInteger(abs)) text = Math.round(abs).toLocaleString()
  else text = abs.toFixed(1)
  return `${sign}${text}${isRes ? '%' : ''}`
}

function formatPct (pct: number) {
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}
</script>
