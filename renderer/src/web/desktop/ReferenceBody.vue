<template>
  <!-- Deathloom fork (layout review step 2): Reference tab. Things you look up:
       cheat sheets, recipes, your own league tracking, and Help. The Cheat sheets
       panel (overlay, in game, All tab) still shows all of them in one. -->
  <SubTabView view="reference" :tabs="TABS">
    <template #default="{ sub }">
      <CheatSheetsBody v-if="sub === 'sheets'" key="sheets" only="sheets" />
      <CheatSheetsBody v-else-if="sub === 'recipes'" key="recipes" only="recipes" />
      <CheatSheetsBody v-else-if="sub === 'tracking'" key="tracking" only="tracking" />
      <HelpBody v-else />
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import SubTabView from './SubTabView.vue'
import { LazyCheatSheetsBody as CheatSheetsBody, LazyHelpBody as HelpBody } from '../ui/LazyBodies'

const TABS = [
  { id: 'sheets', label: 'Cheat sheets', icon: 'fa-book', title: 'League mechanics: Covens, Betrayal, Heist, Delve, Sanctum, map mechanics' },
  { id: 'recipes', label: 'Recipes', icon: 'fa-balance-scale', title: 'Vendor recipes and the campaign bench recipes' },
  { id: 'tracking', label: 'Tracking', icon: 'fa-tasks', title: 'Your own league tracking: Thread planner, Challenges, league checklist' },
  { id: 'help', label: 'Help', icon: 'fa-question-circle', title: 'How to use Orbhoarder, where to get a build, FAQ' }
] as const
</script>
