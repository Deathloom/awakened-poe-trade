<template>
  <!-- Deathloom fork (Q7): Labyrinth while levelling. Trials per difficulty (ticked
       from Client.txt or by hand) and the 2 ascendancy points the next lab gives. -->
  <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
    <div class="lg-head flex items-baseline gap-x-2">
      <span><i class="fas fa-dungeon mr-1 text-gray-500" />Labyrinth</span>
      <span class="normal-case text-gray-500">
        <template v-for="(r, i) of rows" :key="r.lab"><template v-if="i"> · </template>
          <span :class="r.done === r.trials.length ? 'text-gray-300' : ''">{{ LAB_LABEL[r.lab] }} {{ r.done }}/{{ r.trials.length }}</span></template>
      </span>
      <div class="ml-auto flex items-center gap-x-1">
        <button class="ui-btn ui-btn-quiet text-xs" :class="{ 'ui-btn-on': open }" title="Trial checklist (click a trial to tick it by hand)"
          @click="toggleOpen"><i class="fas fa-tasks" />Trials</button>
        <button class="ui-btn ui-btn-quiet text-xs" :class="{ 'ui-btn-on': helpOpen }" title="Where this comes from"
          @click="helpOpen = !helpOpen"><i class="fas fa-question-circle" /></button>
      </div>
    </div>

    <!-- next ascendancy pick -->
    <div v-if="next" class="flex flex-wrap items-baseline gap-x-2">
      <span class="text-xs text-gray-500 shrink-0">{{ LAB_LABEL[next.lab] }} lab, 2 points:</span>
      <template v-if="next.picks.length">
        <span v-for="(n, i) of next.picks" :key="n.id" class="text-blue-300"
          :title="plan?.ascendancyClass ? `${plan.ascendancyClass} ascendancy passive` : 'Ascendancy passive'"><template v-if="i">+ </template>{{ n.name }}</span>
      </template>
      <span v-else-if="plan" class="text-gray-500 text-xs">none in this levelling tree (a later tree may have them)</span>
      <span v-else class="text-gray-500 text-xs">needs a Path of Building build</span>
    </div>
    <div v-else class="text-xs text-gray-500">All four labs done.</div>
    <div v-if="laterPicks.length" class="text-xs text-gray-600">Then: {{ laterPicks.join(' · ') }}</div>

    <!-- trial checklist -->
    <div v-if="open" class="mt-1 space-y-0.5 text-xs">
      <div v-for="r of rows" :key="r.lab" class="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
        <span class="w-16 text-gray-500 shrink-0">{{ LAB_LABEL[r.lab] }}</span>
        <button v-for="t of r.trials" :key="t.id" class="ui-btn ui-btn-quiet text-xs" :class="{ 'opacity-50': t.done }"
          :title="(t.done ? 'Done' : 'Not done yet') + (manual.trials?.[t.id] != null ? ' (ticked by hand)' : '') + '. Click to change.'"
          @click="toggleTrial(t.id, !t.done)">
          <i :class="t.done ? 'fas fa-check text-green-500' : 'far fa-square text-gray-500'" />A{{ t.act }} {{ t.zone.replace(/^The /, '') }}</button>
      </div>
      <label class="flex items-center gap-x-1 text-gray-500">Labs done
        <select class="bg-gray-700 rounded px-1" :value="manual.labs ?? ''" @change="setLabs(($event.target as HTMLSelectElement).value)">
          <option value="">From the game log ({{ logLabs }})</option>
          <option v-for="n of 5" :key="n" :value="n - 1">{{ n - 1 }}</option>
        </select>
      </label>
      <button v-if="hasManual" class="ui-btn ui-btn-quiet text-xs" title="Forget the hand ticks for this character" @click="clearManual">
        <i class="fas fa-undo" />Follow the game log again</button>
    </div>
    <div v-if="helpOpen" class="mt-1 text-xs text-gray-500 leading-snug">
      Trials tick from Client.txt: a "trial completed" game message in that trial's zone, or entering a Labyrinth
      (it only lets you in with all its trials done). The exact game message isn't confirmed yet, so tick by hand
      if one stays open. Labs count when Izaro falls for good. The 2 points come from your Path of Building build's
      ascendancy, in the order its levelling trees list them (PoB keeps no order); passives the game log shows taken
      are skipped. With the tree map loaded the small passives on the way are counted too. Per character; nothing is sent anywhere.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { PobPlan } from '@ipc/types'
import { treeLayout } from '../pob/plan-store'
import {
  LAB_LABEL, LAB_MANUAL_KEY, ascendancyPoints, labsDone, loadLabManual, nextAscendancy, saveLabManual, trialRows,
  type LabManual, type LabProgress
} from './lab-helper'

const props = defineProps<{
  charName: string
  progress: (LabProgress & { alloc?: Record<string, number> }) | null | undefined
  plan: PobPlan | null
}>()

const all = ref(loadLabManual())
const onStorage = (e: StorageEvent) => { if (e.key === LAB_MANUAL_KEY) all.value = loadLabManual() }
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })

const manual = computed<LabManual>(() => all.value[props.charName] ?? {})
const hasManual = computed(() => manual.value.labs != null || Object.keys(manual.value.trials ?? {}).length > 0)
function change (m: LabManual) {
  // this character last (the store keeps the 20 most recently changed)
  const rest = Object.entries(all.value).filter(([k]) => k !== props.charName)
  all.value = Object.fromEntries([...rest, [props.charName, m]])
  saveLabManual(all.value)
}
function toggleTrial (id: string, done: boolean) {
  change({ ...manual.value, trials: { ...manual.value.trials, [id]: done } })
}
function setLabs (text: string) {
  change({ ...manual.value, labs: text === '' ? undefined : Number(text) })
}
function clearManual () { change({}) }

const rows = computed(() => trialRows(props.progress, manual.value))
const logLabs = computed(() => labsDone(props.progress, undefined))
const done = computed(() => labsDone(props.progress, manual.value))
const points = computed(() => ascendancyPoints(props.plan?.ascendancy ?? [], treeLayout.value))
// ascendancy passives taken (game log "Successfully allocated passive skill")
const allocated = computed(() => new Set(Object.entries(props.progress?.alloc ?? {}).filter(([, c]) => c > 0).map(([k]) => k.trim().toLowerCase())))
const next = computed(() => nextAscendancy(points.value, done.value, allocated.value))
const laterPicks = computed(() => next.value?.later.map(n => n.name) ?? [])

// checklist open / closed, remembered
const OPEN_KEY = 'deathloom.next.lab-open.v1'
const open = ref((() => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } })())
function toggleOpen () {
  open.value = !open.value
  try { localStorage.setItem(OPEN_KEY, open.value ? '1' : '0') } catch {}
}
const helpOpen = ref(false)
</script>
