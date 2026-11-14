<template>
  <!-- Deathloom fork: campaign guide + levelling planner in one pane (Loot Goblin
       window): where to go, which quest gem to take, gem swaps and the next passives. -->
  <div class="flex flex-col gap-2 h-full min-h-0">
    <div class="levelling-guide min-h-0"><CampaignGuideBody tall /></div>
    <div class="flex-1 min-h-0"><PobNext /></div>
  </div>
</template>

<script setup lang="ts">
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import PobNext from '../pob/PobNext.vue'
</script>

<style>
.levelling-guide {
  flex: 0 0 38%;
  --hud-w: 100%;
  --hud-h: 100%;
}
</style>
