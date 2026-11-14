<template>
  <!-- Deathloom fork: stash tracker (personal opt-in; reads tabs with your POESESSID, manual refresh only) -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <StashTrackerBody />
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { Widget as WidgetT, Anchor } from '../overlay/widgets'

export interface StashTrackerWidget extends WidgetT {
  anchor: Anchor
}

export default {
  widget: {
    type: 'stash-tracker',
    instances: 'single',
    initInstance: (): StashTrackerWidget => ({
      wmId: 0,
      wmType: 'stash-tracker',
      wmTitle: '{icon=fa-box-open}',
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tl', x: 45, y: 15 }
    })
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import Widget from '../overlay/Widget.vue'
import StashTrackerBody from './StashTrackerBody.vue'

defineProps<{ config: StashTrackerWidget }>()
</script>
