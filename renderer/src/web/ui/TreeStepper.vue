<template>
  <!-- Deathloom fork: step along the build's order: back / forward 1 or 5 passives -->
  <span class="inline-flex items-center gap-0.5 shrink-0" title="Move along the build's order. The tree doesn't follow your allocations by itself: step forward as you take passives in game.">
    <button class="px-1 text-gray-400 hover:text-gray-100 disabled:opacity-30" :disabled="pos <= 0" title="Back 5 passives" @click="$emit('step', -5)"><i class="fas fa-angle-double-left" /></button>
    <button class="px-1 text-gray-400 hover:text-gray-100 disabled:opacity-30" :disabled="pos <= 0" title="Back 1 passive" @click="$emit('step', -1)"><i class="fas fa-angle-left" /></button>
    <span class="tabular-nums text-gray-300 px-0.5">{{ pos }}/{{ len }}</span>
    <button class="px-1 text-gray-400 hover:text-gray-100 disabled:opacity-30" :disabled="pos >= len" title="Forward 1 passive (I took it)" @click="$emit('step', 1)"><i class="fas fa-angle-right" /></button>
    <button class="px-1 text-gray-400 hover:text-gray-100 disabled:opacity-30" :disabled="pos >= len" title="Forward 5 passives" @click="$emit('step', 5)"><i class="fas fa-angle-double-right" /></button>
  </span>
</template>

<script setup lang="ts">
defineProps<{ pos: number, len: number }>()
defineEmits<{ (e: 'step', delta: number): void }>()
</script>
