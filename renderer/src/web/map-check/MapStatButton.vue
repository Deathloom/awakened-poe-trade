<template>
  <div class="flex" :title="buildTitle">
    <button @click="handleClick" :class="[$style.cycleBtn, btnStyle().bg, { [$style.buildDanger]: buildFlag?.danger, [$style.buildGrey]: greyed }]">
      <i class="text-center w-4 shrink-0"
        :class="btnStyle().icon" />
      <ItemModifierText class="truncate"
        :text="stat.matcher" :roll="stat.roll" />
      <!-- Deathloom fork (Q4): dangerous for the active PoB build -->
      <i v-if="buildFlag?.danger" class="fas fa-hammer ml-auto shrink-0 text-red-400" />
    </button>
    <button @click="toggleSeenStatus" :class="$style.seenBtn">
      <i v-if="newStatIconVisible()" class="fas fa-eye-slash"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, useCssModule } from 'vue'
import { PreparedStat } from './prepare-map-stats'
import { nextDecision, decisionCreate, type MapCheckConfig } from './common.js'
import type { BuildModFlag } from './build-map-rules'

import ItemModifierText from '../ui/ItemModifierText.vue'

const props = defineProps<{
  stat: PreparedStat,
  config: MapCheckConfig
  // Deathloom fork (Q4): undefined = no build loaded (or turned off), null = the
  // rules don't know this mod (doesn't affect the build)
  buildFlag?: BuildModFlag | null
}>()

const $style = useCssModule()

const entry = computed(() => props.config.selectedStats
  .find(({ matcher }) => matcher === props.stat.matcher))

const decision = computed<string>({
  get () {
    if (!entry.value) return '-'
    return entry.value.decision[props.config.profile - 1]
  },
  set (value) {
    const newSet = decisionCreate(value, props.config.profile, entry.value?.decision)
    if (!entry.value) {
      props.config.selectedStats.push({
        matcher: props.stat.matcher,
        decision: newSet
      })
    } else {
      entry.value.decision = newSet
    }
  }
})

// grey what doesn't affect the build, unless you coloured it yourself
// (mods dangerous for every build are never greyed)
const greyed = computed(() => props.buildFlag !== undefined && !props.buildFlag?.danger && !props.buildFlag?.general &&
  (decision.value === '-' || decision.value === 's'))
const buildTitle = computed(() => {
  if (props.buildFlag === undefined) return undefined
  if (props.buildFlag === null) return 'PoB: no build-specific rule for this mod'
  if (props.buildFlag.general) return `PoB: ${props.buildFlag.reason}`
  return `PoB: ${props.buildFlag.danger ? 'dangerous for your build' : 'fine for your build'}. ${props.buildFlag.reason}`
})

function newStatIconVisible (): boolean {
  if (props.config.showNewStats) {
    return (decision.value === '-')
  }
  return false
}

function toggleSeenStatus () {
  if (props.config.showNewStats) {
    decision.value = (decision.value === '-') ? 's' : '-'
  }
}

function btnStyle () {
  switch (decision.value) {
    case 'd': return { bg: $style.danger, icon: 'fas fa-skull-crossbones' }
    case 'w': return { bg: $style.warn, icon: 'fas fa-exclamation-triangle' }
    case 'g': return { bg: $style.good, icon: 'fas fa-check' }
  }
  return { bg: $style.normal, icon: undefined }
}

function handleClick () {
  decision.value = nextDecision(decision.value)
}
</script>

<style lang="postcss" module>
.cycleBtn {
  @apply p-2;
  display: flex;
  align-items: center;
  @apply gap-x-2;
  line-height: 1;
  text-align: left;
  overflow: hidden;
  flex: 1;

  &.danger { @apply bg-red-700; }
  &.warn { @apply bg-orange-600; }
  &.good { @apply bg-green-700; }

  &.normal:hover {
    @apply bg-gray-700;
  }

  /* Deathloom fork (Q4) */
  &.buildDanger { box-shadow: inset 3px 0 0 theme('colors.red.500'); }
  &.buildGrey { opacity: 0.5; }
}

.seenBtn {
  @apply w-8;
  display: flex;
  align-items: center;
  justify-content: center;
  @apply text-gray-600;
  text-align: center;
  line-height: 1;
}
</style>
