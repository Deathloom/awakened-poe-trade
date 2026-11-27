<template>
  <!-- Deathloom fork (layout review step 5): Mapping tab. Everything for a map
       session: atlas tree, This session (map timer, loot), Map mods (Settings → Maps)
       and Farming (profit per hour). Each is still a panel too (overlay, in game, All tab). -->
  <SubTabView view="mapping" :tabs="TABS">
    <template #default="{ sub }">
      <div v-if="sub === 'atlas'" class="h-full min-h-0 flex flex-col rounded bg-gray-800"><AtlasTreeMap /></div>
      <PlaySessionBody v-else-if="sub === 'session'" class="h-full" />
      <MapModsBody v-else-if="sub === 'mods'" />
      <div v-else class="h-full min-h-0 rounded bg-gray-800 overflow-hidden"><MarketFarming /></div>
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import SubTabView from './SubTabView.vue'
import AtlasTreeMap from '../atlas/LazyAtlasTreeMap'
import { LazyPlaySessionBody as PlaySessionBody } from '../ui/LazyBodies'
import { defineAsyncComponent } from 'vue'

const MarketFarming = defineAsyncComponent(() => import('../market-history/MarketFarming.vue'))
// Settings → Maps page (the mod list is big): loaded when the sub-tab opens
const MapModsBody = defineAsyncComponent(() => import('./MapModsBody.vue'))
const TABS = [
  { id: 'atlas', label: 'Atlas tree', icon: 'fa-globe', title: 'Your atlas tree builds: step along one, edit and share', poe1Only: true },
  { id: 'session', label: 'This session', icon: 'fa-stopwatch', title: 'Map timer, maps run and loot this session' },
  { id: 'mods', label: 'Map mods', icon: 'fa-skull-crossbones', title: 'Map mods to colour in the map check (the same as Settings → Maps)', poe1Only: true },
  { id: 'farm', label: 'Farming', icon: 'fa-seedling', title: 'Profit per map and per hour, by strategy or league mechanic', poe1Only: true }
] as const
</script>
