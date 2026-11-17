<template>
  <button @click="updateInput" :class="$style.toggle">
    <!-- Deathloom fork (Gerhard 17 Nov): a plain tickbox (the toggle icon didn't show for him) -->
    <span class="ui-tick" :class="{ on: modelValue }" aria-hidden="true" />
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

  gap: 0.375rem;
  text-align: left;

  &:disabled {
    @apply text-gray-600;
  }
}
</style>

<style lang="postcss">
.ui-tick {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 0.2rem;
  border: 1.5px solid rgb(var(--g-400));
  background: rgb(var(--g-900));
}
.ui-tick.on {
  border-color: rgb(var(--accent));
  background: rgb(var(--accent));
}
.ui-tick.on::after {
  content: '';
  width: 0.3rem;
  height: 0.55rem;
  margin-top: -0.1rem;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
button:disabled > .ui-tick { opacity: 0.4; }
</style>
