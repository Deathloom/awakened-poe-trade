<template>
  <!-- Deathloom fork: copy the in-game market search text (press / in game, then Ctrl+V) -->
  <button class="ui-btn ui-btn-quiet px-2 rounded shrink-0"
    :title="`Copy '${text}' for the in-game market (press / then Ctrl+V)`"
    @click="copy(text)">
    <template v-if="copiedKey"><i class="fas fa-check text-green-400" /> Copied</template>
    <template v-else><i class="far fa-copy" /> Copy</template>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ParsedItem } from '@/parser'
import { marketSearchText, useCopyFeedback } from '@/web/pob/market'

const props = defineProps<{
  item: ParsedItem
}>()

const text = computed(() => marketSearchText(props.item))
const { copiedKey, copy } = useCopyFeedback()
</script>
