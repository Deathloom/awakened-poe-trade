<template>
  <img
    :src="icon === '%NOT_FOUND%' || icon === '' ? '/images/poe2-missing.svg' : icon"
    class="max-w-full max-h-full mx-auto"
    :class="{ 'overflow-hidden': overflowHidden }"
  />
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    icon: {
      type: String,
      required: true,
    },
    overflowHidden: {
      type: Boolean,
      default: false,
    },
  },
});
</script>
