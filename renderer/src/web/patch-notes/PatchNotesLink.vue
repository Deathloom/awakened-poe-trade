<template>
  <!-- Deathloom fork: link to GGG's PC patch notes; a dot + title when newer
       notes came out since you last opened them -->
  <a :href="url" target="_blank" rel="noopener noreferrer" class="ui-btn ui-btn-quiet whitespace-nowrap"
    :title="fresh ? `New: ${fresh.title} (pathofexile.com)` : 'Path of Exile patch notes (pathofexile.com)'"
    @click="markPatchNotesSeen()">
    <i class="fas fa-scroll mr-1" />Patch notes<template v-if="fresh"><span class="ml-1 inline-block w-2 h-2 rounded-full bg-yellow-400 align-middle" /><span v-if="showTitle" class="ml-1 text-yellow-300">{{ fresh.title }}</span></template>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { linkUrl, unseen } from './patch-notes'
import { patchNotes, markPatchNotesSeen } from './patch-notes-store'

defineProps<{ showTitle?: boolean }>()

const url = computed(() => linkUrl(patchNotes.value))
const fresh = computed(() => unseen(patchNotes.value))
</script>
