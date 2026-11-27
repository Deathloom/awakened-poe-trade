<template>
  <!-- Deathloom fork (layout review step 5): Levelling tab. Guide + planner, and
       the Lab (poelab.com) that used to be its own tab: you do the lab while
       levelling. The Lab page stays alive once opened; the guide only runs while
       its sub-tab is shown. -->
  <SubTabView view="levelling" :tabs="TABS">
    <template #default="{ sub: s }">
      <LevellingBody v-if="active && s === 'guide'" />
      <div v-if="labOpened" v-show="s === 'lab'" class="h-full min-h-0"><LabSiteBody /></div>
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SubTabView from './SubTabView.vue'
import LabSiteBody from './LabSiteBody.vue'
import { useSubTab } from './view-route'
import { LazyLevellingBody as LevellingBody } from '../ui/LazyBodies'

const props = defineProps<{ active: boolean }>()
const TABS = [
  { id: 'guide', label: 'Guide', icon: 'fa-route', title: 'Campaign guide, quest gems, gem swaps and the next passives' },
  { id: 'lab', label: 'Lab', icon: 'fa-dungeon', title: "Today's labyrinth layouts on poelab.com (community site, shown as-is) and your run checklist" }
] as const
const sub = useSubTab('levelling', TABS.map(t => t.id), 'guide')
const labOpened = ref(props.active && sub.value === 'lab')
watch(() => props.active && sub.value === 'lab', (on) => { if (on) labOpened.value = true })
</script>
