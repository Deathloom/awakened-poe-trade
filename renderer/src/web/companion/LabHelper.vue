<template>
  <!-- Deathloom fork (Q7): Labyrinth while levelling. Trials per difficulty (ticked
       from Client.txt or by hand), the next lab, and the ascendancy notables this
       levelling tree adds (PoB gives no order for them, so none is claimed). -->
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

    <!-- next lab + this tree's ascendancy notables -->
    <div v-if="view.lab" class="text-xs text-gray-500">Next: {{ LAB_LABEL[view.lab] }} lab (2 ascendancy points)</div>
    <div v-else class="text-xs text-gray-500">All four labs done.</div>
    <div v-if="!plan" class="text-xs text-gray-500">Ascendancy: needs a Path of Building build</div>
    <div v-else-if="view.adds.length" class="flex flex-wrap items-baseline gap-x-1">
      <span class="text-xs text-gray-500 shrink-0">This tree adds:</span>
      <span class="text-blue-300" :title="ascTitle">{{ view.adds.map(n => n.name).join(', ') }}</span>
      <span class="text-xs text-gray-500">(order not set in PoB<template v-if="view.smalls"> · +{{ view.smalls }} small passive{{ view.smalls === 1 ? '' : 's' }} on the way</template>)</span>
    </div>
    <div v-else-if="view.taken.length" class="text-xs text-gray-500">This tree's ascendancy notables are taken ({{ view.taken.map(n => n.name).join(', ') }}).</div>
    <div v-else class="text-xs text-gray-500">This levelling tree adds no ascendancy notable over the previous one.</div>
    <div v-if="plan && view.adds.length && view.taken.length" class="text-xs text-gray-600">Taken already: {{ view.taken.map(n => n.name).join(', ') }}</div>

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
      if one stays open. A lab counts as done when Izaro says "Triumphant at last" or when you enter a higher lab;
      he has other last lines too, so if the count is behind, set <i>Labs done</i> under <i class="fas fa-tasks" /> Trials.
      "This tree adds" is what your Path of Building levelling tree for this level adds to the ascendancy over the
      previous tree (notables only, sorted by name, multiple-choice options left out). PoB keeps no order, so pick
      which to take first yourself. With the tree map loaded
      (and the start known) the small passives on the way are counted too. Per character; nothing is sent anywhere.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PobPlan } from '@ipc/types'
import { treeLayout } from '../pob/plan-store'
import { LAB_LABEL, ascendancyView, labsDone, trialRows, type LabManual, type LabProgress } from './lab-helper'
import { labManualAll, setLabManual } from './lab-store'

const props = defineProps<{
  charName: string
  progress: (LabProgress & { alloc?: Record<string, number>, firstLevel?: number }) | null | undefined
  plan: PobPlan | null
}>()

const manual = computed<LabManual>(() => labManualAll.value[props.charName] ?? {})
const hasManual = computed(() => manual.value.labs != null || Object.keys(manual.value.trials ?? {}).length > 0)
function change (m: LabManual) { setLabManual(props.charName, m) }
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
const view = computed(() => ascendancyView(props.plan?.ascendancy ?? [], done.value, {
  // no automatic tree tracking (Gerhard 27 Nov 2026): the game log's allocations aren't used
  layout: treeLayout.value,
  ascendancyClass: props.plan?.ascendancyClass
}))
const ascTitle = computed(() => `${props.plan?.ascendancyClass ?? 'Ascendancy'} notables this levelling tree adds over the previous one (Path of Building)`)

// checklist open / closed, remembered
const OPEN_KEY = 'deathloom.next.lab-open.v1'
const open = ref((() => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } })())
function toggleOpen () {
  open.value = !open.value
  try { localStorage.setItem(OPEN_KEY, open.value ? '1' : '0') } catch {}
}
const helpOpen = ref(false)
</script>
