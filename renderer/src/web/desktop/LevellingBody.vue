<template>
  <!-- Deathloom fork: campaign guide + levelling planner in one pane (Loot Goblin
       window): where to go, which quest gem to take, gem swaps and the next passives.
       Drag the line between them to resize. -->
  <div ref="box" class="flex flex-col h-full min-h-0">
    <div class="levelling-guide min-h-0 overflow-hidden" :style="{ flex: `${sizes[0]} 1 0` }"><CampaignGuideBody tall /></div>
    <SplitGutter dir="y" @drag="d => drag(0, d, box?.clientHeight ?? 0)" @end="save" @reset="reset" />
    <div class="min-h-0" :style="{ flex: `${sizes[1]} 1 0` }"><PobNext /></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import PobNext from '../pob/PobNext.vue'
import SplitGutter from './SplitGutter.vue'
import { useSplit } from './split'

const box = ref<HTMLElement>()
// the guide only needs the current zone and a few steps: smaller by default
const { sizes, drag, save, reset } = useSplit('levelling', [0.3, 0.7])
</script>

<style>
.levelling-guide {
  --hud-w: 100%;
  --hud-h: 100%;
}
</style>
