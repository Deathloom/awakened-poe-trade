<template>
  <!-- Deathloom fork (layout review step 5): Build tab. Gear, gems and tree, and
       Build progress (was only an All tab panel). -->
  <SubTabView view="build" :tabs="TABS">
    <template #default="{ sub }">
      <PobGearBody v-if="sub === 'build'" :active="true" desktop />
      <div v-else class="h-full min-h-0 rounded bg-gray-800"><BuildProgressPanel /></div>
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import SubTabView from './SubTabView.vue'
import { LazyPobGearBody as PobGearBody, LazyBuildProgressPanel as BuildProgressPanel } from '../ui/LazyBodies'

const TABS = [
  { id: 'build', label: 'Gear, gems and tree', icon: 'fa-hammer', title: 'Gear, gems and tree of the active build' },
  { id: 'progress', label: 'Progress', icon: 'fa-tasks', title: 'Build progress: tree step, gem ticks, gear ticks, next upgrades' }
] as const
</script>
