<template>
  <!-- Deathloom fork (19 Nov 2026, calmer UI): a "⋯" button that opens a list of
       labelled actions. Rare actions live here instead of as loose icons. -->
  <div ref="root" class="relative inline-block">
    <button type="button" class="ui-btn" :class="[buttonClass, { 'ui-btn-on': open }]" :title="title" :aria-expanded="open"
      @click.stop="open = !open">
      <slot name="button"><i class="fas fa-ellipsis-h" /></slot>
    </button>
    <div v-if="open" class="absolute z-50 mt-1 min-w-[12rem] rounded bg-gray-800 border border-gray-600 shadow-lg py-1 text-sm"
      :class="alignRight ? 'right-0' : 'left-0'">
      <template v-for="(it, i) of items" :key="i">
        <div v-if="it.divider" class="my-1 border-t border-gray-700" />
        <button v-else type="button" class="w-full flex items-center gap-x-2 px-3 py-1 text-left text-gray-200 hover:bg-gray-700 disabled:opacity-40"
          :disabled="it.disabled" :title="it.hint" @click.stop="pick(it)">
          <i v-if="it.icon" class="w-4 text-center text-gray-400" :class="it.icon" />
          <span class="flex-1">{{ it.label }}</span>
          <i v-if="it.checked" class="fas fa-check text-xs text-gray-400" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

export interface UiMenuItem {
  label?: string
  icon?: string
  hint?: string
  disabled?: boolean
  checked?: boolean
  divider?: boolean
  action?: () => void
}

defineProps<{ items: UiMenuItem[], title?: string, buttonClass?: string, alignRight?: boolean }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
function pick (it: UiMenuItem) {
  open.value = false
  it.action?.()
}
function onDoc (e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey (e: KeyboardEvent) { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey) })
onUnmounted(() => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) })
</script>

<style lang="postcss">
/* one button look for the whole app: visible background, so it reads as clickable */
.ui-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.5rem;
  min-height: 1.5rem;
  border-radius: 0.25rem;
  background: rgb(var(--g-700));
  color: rgb(var(--g-200));
  font-size: 0.8125rem;
  white-space: nowrap;
}
.ui-btn:hover { background: rgb(var(--g-600)); color: rgb(var(--g-100)); }
.ui-btn:disabled { opacity: 0.4; }
.ui-btn-on { background: rgb(var(--g-600)); color: rgb(var(--g-100)); }
.ui-btn-primary { background: rgb(var(--accent) / 0.25); box-shadow: inset 0 0 0 1px rgb(var(--accent) / 0.6); color: rgb(var(--g-100)); }
.ui-btn-primary:hover { background: rgb(var(--accent) / 0.4); }
.ui-btn-quiet { background: transparent; color: rgb(var(--g-400)); }
.ui-btn-quiet:hover { background: rgb(var(--g-700)); color: rgb(var(--g-100)); }
.ui-btn-danger { background: rgb(185 28 28); color: #fff; }
.ui-btn-danger:hover { background: rgb(220 38 38); color: #fff; }
/* one tab look for panel headers (same as the Build panel) */
.ui-tab { padding: 0 0.5rem; border-radius: 0.25rem; color: rgb(var(--g-500)); white-space: nowrap; }
.ui-tab:hover { color: rgb(var(--g-200)); }
.ui-tab-on, .ui-tab-on:hover { background: rgb(var(--g-700)); color: rgb(var(--g-100)); }
</style>
