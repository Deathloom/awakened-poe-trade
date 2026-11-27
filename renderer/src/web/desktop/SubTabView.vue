<template>
  <!-- Deathloom fork (layout review): a top tab with sub-tabs (Orbhoarder window) -->
  <div class="flex flex-col h-full min-h-0 gap-1">
    <div class="flex flex-wrap items-center gap-1 shrink-0">
      <button v-for="t of tabs" :key="t.id" class="ui-tab py-0.5" :class="{ 'ui-tab-on': cur === t.id }"
        :title="t.title" :data-tour="`${view}-${t.id}`" @click="cur = t.id">
        <i v-if="t.icon" class="fas mr-1" :class="t.icon" />{{ t.label }}</button>
      <slot name="bar" />
    </div>
    <div class="flex-1 min-h-0">
      <slot :sub="cur" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSubTab } from './view-route'

export interface SubTab { id: string, label: string, icon?: string, title?: string }
const props = defineProps<{ view: string, tabs: readonly SubTab[] }>()
const cur = useSubTab(props.view, props.tabs.map(t => t.id), props.tabs[0].id)
</script>
