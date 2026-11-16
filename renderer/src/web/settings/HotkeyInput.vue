<template>
  <input
    @keyup="handleKeyup"
    @keydown.prevent
    :placeholder="modelValue || t('settings.no_key')"
    :class="{ 'hk-unset': !modelValue, 'hk-game': gameUse }"
    :title="gameUse ? `The game uses ${modelValue} for ${gameUse} by default; Orbhoarder would take it first. Pick another key unless you changed it in game.` : undefined"
    class="hk-input rounded bg-gray-900 px-1 text-center font-poe" />
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { KeyToCode, hotkeyToString } from '@ipc/KeyToCode'
import { poe1KeyUse } from '@ipc/game-keys'

export default defineComponent({
  emits: ['update:modelValue'],
  props: {
    modelValue: {
      type: String as PropType<string | null>,
      default: null
    },
    noModKeys: {
      type: Boolean,
      default: false
    },
    required: {
      type: Boolean,
      default: false
    }
  },
  setup (props, ctx) {
    const { t } = useI18n()

    // Deathloom fork: warn about keys PoE1 uses by default
    const gameUse = computed(() => poe1KeyUse(props.modelValue))

    return {
      t,
      gameUse,
      handleKeyup (e: KeyboardEvent) {
        e.preventDefault()
        e.stopPropagation()

        if (e.code === 'Backspace') {
          if (!props.required) {
            ctx.emit('update:modelValue', null)
          }
          return
        }

        let { code, ctrlKey, shiftKey, altKey } = e

        if (code.startsWith('Key')) {
          code = code.slice('Key'.length)
        } else if (code.startsWith('Digit')) {
          code = code.slice('Digit'.length)
        } else if (e.key === 'Cancel' && code === 'Pause') {
          code = 'Cancel'
        }

        if ((KeyToCode as Record<string, number>)[code]) {
          code = hotkeyToString([code], ctrlKey, shiftKey, altKey)
          if (code.includes('F12')) return
          if (props.noModKeys && code.includes('+')) return
          ctx.emit('update:modelValue', code)
        }
      }
    }
  }
})
</script>
