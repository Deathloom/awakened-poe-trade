<template>
  <!-- Deathloom fork (16 Nov 2026): Craft tab of the Orbhoarder window -->
  <div class="h-full min-h-0 flex flex-col rounded-lg bg-gray-800 p-3 craft-root">
    <div class="flex gap-1 mb-3 shrink-0">
      <button v-for="t of TABS" :key="t.key" class="craft-subtab" :class="{ 'craft-subtab-on': tab === t.key }" @click="setTab(t.key)">
        <i class="fas mr-1.5" :class="t.icon" />{{ t.label }}</button>
    </div>
    <div class="flex-1 min-h-0">
      <CraftSimulator v-if="tab === 'craft'" />
      <TimelessExplorer v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { CRAFT_REQUEST_EVENT, CRAFT_REQUEST_KEY } from './craft-request'
import CraftSimulator from './CraftSimulator.vue'
import TimelessExplorer from './TimelessExplorer.vue'

const TABS = [
  { key: 'craft', label: 'Crafting simulator', icon: 'fa-dice' },
  { key: 'timeless', label: 'Timeless jewels', icon: 'fa-gem' }
] as const
type Tab = typeof TABS[number]['key']
const KEY = 'deathloom.craft-tab.v1'
const tab = ref<Tab>((() => { try { return localStorage.getItem(KEY) === 'timeless' ? 'timeless' : 'craft' } catch { return 'craft' } })())
function setTab (t: Tab) {
  tab.value = t
  try { localStorage.setItem(KEY, t) } catch {}
}
// "Craft this" from the build gear: show the simulator
const toCraft = () => { tab.value = 'craft' }
const onStorage = (e: StorageEvent) => { if (e.key === CRAFT_REQUEST_KEY && e.newValue) toCraft() }
window.addEventListener(CRAFT_REQUEST_EVENT, toCraft)
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener(CRAFT_REQUEST_EVENT, toCraft); window.removeEventListener('storage', onStorage) })
</script>

<style>
/* Deathloom fork: flat, readable controls (first piece of the new look) */
.craft-root { font-size: 0.875rem; }
.craft-field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: theme('colors.gray.400'); }
.craft-input {
  background: theme('colors.gray.900'); color: theme('colors.gray.100');
  border: 1px solid theme('colors.gray.700'); border-radius: 0.375rem;
  padding: 0.3rem 0.5rem; font-size: 0.875rem; outline: none;
}
.craft-input:focus { border-color: rgb(var(--accent)); }
.craft-btn, .craft-btn-primary {
  border-radius: 0.375rem; padding: 0.35rem 0.85rem; font-size: 0.875rem; white-space: nowrap;
}
.craft-btn { background: rgb(var(--g-700)); color: rgb(var(--g-100)); }
.craft-btn:hover:not(:disabled) { background: rgb(var(--g-600)); }
/* same look as .ui-btn-primary (accent tint), so the main action matches the rest of the app */
.craft-btn-primary { background: rgb(var(--accent) / 0.25); box-shadow: inset 0 0 0 1px rgb(var(--accent) / 0.6); color: rgb(var(--g-100)); }
.craft-btn-primary:hover:not(:disabled) { background: rgb(var(--accent) / 0.4); }
.craft-btn:disabled, .craft-btn-primary:disabled { opacity: 0.45; cursor: default; }
.craft-subtab { padding: 0.35rem 0.85rem; border-radius: 0.375rem; color: rgb(var(--g-500)); }
.craft-subtab:hover { color: rgb(var(--g-200)); }
.craft-subtab-on, .craft-subtab-on:hover { background: rgb(var(--g-700)); color: rgb(var(--g-100)); }
.craft-panel { background: theme('colors.gray.900'); border-radius: 0.5rem; padding: 0.75rem; }
.craft-card { background: theme('colors.gray.900'); border-radius: 0.5rem; padding: 0.6rem 0.75rem; border: 1px solid transparent; }
.craft-card-mine { border-color: theme('colors.green.700'); }
.craft-heading { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: theme('colors.gray.500'); margin-bottom: 0.4rem; }
.craft-mod { padding: 0.35rem 0.4rem; border-radius: 0.375rem; }
.craft-mod:hover { background: theme('colors.gray.800'); }
.craft-mod-on { background: theme('colors.gray.800'); }
.craft-stat { font-size: 1.15rem; font-weight: 600; color: theme('colors.gray.100'); }
.craft-stat-label { font-size: 0.7rem; color: theme('colors.gray.500'); }
.craft-error { color: theme('colors.yellow.300'); font-size: 0.875rem; }
</style>
