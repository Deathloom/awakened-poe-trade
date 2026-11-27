<template>
  <!-- Deathloom fork (layout review step 4): Friends tab. The group's trade board
       and build sharing (GitHub sync); the phone link stays in Settings → Tools. -->
  <SubTabView view="friends" :tabs="TABS">
    <template #default="{ sub }">
      <TradeBoardBody v-if="sub === 'board'" fill />
      <div v-else class="h-full min-h-0 overflow-y-auto rounded bg-gray-800 text-sm">
        <div class="max-w-3xl p-3 space-y-2">
          <div class="text-gray-400">Share builds with your friends through a private GitHub repository: sign in once, then builds sync by themselves (deletions too). Nobody sees your builds until you let them. Shared builds show in the Build tab's build list.</div>
          <BuildSync class="rounded bg-gray-900" />
          <div class="text-gray-500 text-xs"><i class="fas fa-mobile-alt mr-1" />Open this window on your phone: Settings → Tools → Phone or other devices.</div>
        </div>
      </div>
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import SubTabView from './SubTabView.vue'
import BuildSync from '../pob/BuildSync.vue'
import { LazyTradeBoardBody as TradeBoardBody } from '../ui/LazyBodies'

const TABS = [
  { id: 'board', label: 'Board', icon: 'fa-people-carry', title: "Friends' trade board: give away, sell to and ask your group" },
  { id: 'sharing', label: 'Build sharing', icon: 'fa-cloud', title: 'Share builds with your group (GitHub sync)', poe1Only: true }
] as const
</script>
