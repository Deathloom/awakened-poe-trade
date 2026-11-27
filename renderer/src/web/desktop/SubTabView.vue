<template>
  <!-- Deathloom fork (layout review): a top tab with sub-tabs (Orbhoarder window) -->
  <div class="flex flex-col h-full min-h-0 gap-1">
    <div class="flex flex-wrap items-center gap-1 shrink-0">
      <button v-for="t of shown" :key="t.id" class="ui-tab py-0.5" :class="{ 'ui-tab-on': active === t.id }"
        :title="t.title" :data-tour="`${view}-${t.id}`" @click="cur = t.id">
        <i v-if="t.icon" class="fas mr-1" :class="t.icon" />{{ t.label }}</button>
      <slot name="bar" />
    </div>
    <div class="flex-1 min-h-0">
      <slot :sub="active" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSubTab } from './view-route'
import { isPoe2 } from './panels'

// poe1Only (wave 6): hidden while PoE2 is the active game
export interface SubTab { id: string, label: string, icon?: string, title?: string, poe1Only?: boolean }
const props = defineProps<{ view: string, tabs: readonly SubTab[] }>()
const cur = useSubTab(props.view, props.tabs.map(t => t.id), props.tabs[0].id)
const shown = computed(() => {
  const list = isPoe2() ? props.tabs.filter(t => !t.poe1Only) : props.tabs
  return list.length ? list : props.tabs
})
// the saved sub-tab is kept for PoE1; PoE2 shows the first one it has
const active = computed(() => shown.value.some(t => t.id === cur.value) ? cur.value : shown.value[0].id)
</script>
