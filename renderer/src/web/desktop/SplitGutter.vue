<template>
  <!-- Deathloom fork: drag handle between two panels (double-click: default sizes) -->
  <div :class="dir === 'x' ? 'split-gutter split-x' : 'split-gutter split-y'"
    :title="`Drag to resize · double-click to ${resetLabel ?? 'reset'}`" @mousedown.prevent="start" @dblclick="emit('reset')" />
</template>

<script setup lang="ts">
const props = defineProps<{ dir: 'x' | 'y', resetLabel?: string }>()
const emit = defineEmits<{
  (e: 'drag', deltaPx: number): void
  (e: 'end' | 'reset'): void
}>()

function start (e: MouseEvent) {
  let last = props.dir === 'x' ? e.clientX : e.clientY
  const move = (ev: MouseEvent) => {
    const now = props.dir === 'x' ? ev.clientX : ev.clientY
    if (now !== last) emit('drag', now - last)
    last = now
  }
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    document.body.style.cursor = ''
    emit('end')
  }
  document.body.style.cursor = props.dir === 'x' ? 'col-resize' : 'row-resize'
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
}
</script>

<style>
.split-gutter { flex: 0 0 auto; position: relative; z-index: 5; }
.split-gutter::after { content: ''; position: absolute; border-radius: 2px; background: #374151; transition: background 0.15s; }
.split-gutter:hover::after { background: #6b7280; }
.split-x { width: 8px; cursor: col-resize; }
.split-x::after { top: 30%; bottom: 30%; left: 3px; width: 2px; }
.split-y { height: 8px; cursor: row-resize; }
.split-y::after { left: 30%; right: 30%; top: 3px; height: 2px; }
</style>
