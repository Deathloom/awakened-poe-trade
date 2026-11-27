<template>
  <!-- Deathloom fork: Build progress with the levelling planner it steps along with
       running hidden (Build → Progress in the window, and pinned in game) -->
  <div class="h-full min-h-0 flex flex-col">
    <div class="hidden"><LazyPobNext /></div>
    <BuildProgress class="flex-1 min-h-0" />
  </div>
</template>

<script setup lang="ts">
import BuildProgress from './BuildProgress.vue'
import { LazyPobNext } from '../companion/LazyLevelling'
</script>
