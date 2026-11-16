<template>
  <button @click="updateInput" :class="$style.toggle">
    <!-- Deathloom fork: on = accent, off = clearly visible grey (was near-invisible on dark themes) -->
    <i v-if="modelValue" class="fas fa-toggle-on pr-1.5 text-accent text-lg leading-none"></i>
    <i v-else class="fas fa-toggle-off pr-1.5 text-gray-400 text-lg leading-none"></i>
    <slot />
  </button>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'UiToggle',
  emits: ['update:modelValue'],
  props: {
    modelValue: {
      type: Boolean,
      required: true
    }
  },
  setup (props, ctx) {
    return {
      updateInput () {
        ctx.emit('update:modelValue', !props.modelValue)
      }
    }
  }
})
</script>

<style lang="postcss" module>
.toggle {
  display: flex;
  align-items: center;
  height: 1.375rem;

  &:disabled, &:disabled > i {
    @apply text-gray-600;
  }
}
</style>
