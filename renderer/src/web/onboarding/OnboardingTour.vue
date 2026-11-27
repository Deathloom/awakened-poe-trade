<template>
  <!-- Deathloom fork (Q27): first-run tour. Points at the top bar tabs one by one
       and opens each, so a new friend sees what is where. Loaded lazily. -->
  <div class="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label="Orbhoarder tour">
    <!-- dim everything; with a target, the dim is the target's huge shadow (a hole over it) -->
    <div v-if="!rect" class="absolute inset-0 bg-black bg-opacity-60" />
    <div v-else class="absolute rounded-md ring-2 ring-accent pointer-events-none tour-hole"
      :style="{ left: `${rect.left - 3}px`, top: `${rect.top - 3}px`, width: `${rect.width + 6}px`, height: `${rect.height + 6}px` }" />
    <div ref="cardEl" class="absolute bg-gray-800 text-gray-200 rounded border border-gray-600 shadow-lg p-3 leading-snug"
      :style="cardStyle">
      <div class="flex items-center mb-1">
        <span class="text-lg"><i v-if="cur.icon" class="fas mr-2 text-accent" :class="cur.icon" />{{ cur.title }}</span>
        <span class="ml-auto text-xs text-gray-500">{{ step + 1 }} / {{ steps.length }}</span>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="mb-3" v-html="cur.body" />
      <div class="flex items-center gap-2">
        <button v-if="step < steps.length - 1" class="text-sm text-gray-400 hover:text-gray-100" @click="close">Skip tour</button>
        <button v-if="step > 0" class="ml-auto px-3 rounded bg-gray-700 hover:bg-gray-600" @click="go(-1)">Back</button>
        <button ref="nextEl" class="px-3 rounded bg-accent/30 ring-1 ring-accent/60 hover:bg-accent/50 text-gray-100"
          :class="step === 0 ? 'ml-auto' : ''" @click="step < steps.length - 1 ? go(1) : close()">
          {{ step === 0 ? 'Show me' : step < steps.length - 1 ? 'Next' : 'Done' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { AppConfig } from '@/web/Config'
import type { PriceCheckWidget } from '@/web/overlay/widgets'
import { markTourSeen, tourOpen } from './tour-state'

// view: the top bar tab to open for a step (DesktopApp switches to it)
const emit = defineEmits<{ view: [key: string] }>()

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
const overlayKey = esc(AppConfig().overlayKey || 'Shift + Space')
const pc = AppConfig<PriceCheckWidget>('price-check')
const priceKey = esc(pc?.hotkey ? `${pc.hotkeyHold} + ${pc.hotkey}` : (pc?.hotkeyLocked ?? 'the price check hotkey (Settings → Hotkeys)'))

interface Step { title: string, body: string, icon?: string, target?: string, view?: string }
// bodies are our own text; only the two hotkeys come from the config (escaped above)
const steps: Step[] = [
  {
    title: 'Welcome to Orbhoarder',
    icon: 'fa-hand-sparkles',
    body: 'A one-minute look at this window. It works on a second screen next to the game and updates live while you play. ' +
      'Arrow keys or the buttons move through the tour; Esc ends it.'
  },
  { target: 'overview', view: 'overview', icon: 'fa-th-large', title: 'All', body: 'Everything at once. <b>Edit layout</b> adds, moves and resizes panels. It switches between a Levelling and a Mapping layout by itself.' },
  { target: 'build', view: 'build', icon: 'fa-hammer', title: 'Build', body: 'Gear, gems and tree of your Path of Building build. Builds shared in POE-Builds show here for the whole group.' },
  { target: 'levelling', view: 'levelling', icon: 'fa-route', title: 'Levelling', body: 'Campaign guide, quest gems, gem swaps and the next passives. It follows the game log, so it moves on as you do.' },
  { target: 'atlas', view: 'atlas', icon: 'fa-globe', title: 'Atlas', body: 'Your atlas tree builds: step along one with the arrows as you take passives.' },
  { target: 'market', view: 'market', icon: 'fa-chart-line', title: 'Market', body: 'Prices of items you watch (star them in a price check) next to the poe.ninja overview.' },
  { target: 'profit', view: 'profit', icon: 'fa-piggy-bank', title: 'Profit', body: 'Ways to make currency: gem levelling, crafting costs, a currency counter and the league planners (Viscera, Temple, Wombgifts).' },
  { target: 'trade', view: 'trade', icon: 'fa-handshake', title: 'Trade', body: "Trading right now: trade whispers and a ledger of what you bought and sold, <b>Search</b> (who sells an item, cheapest first) and GGG's own <b>Trade site</b> inside this window. You sign in on GGG's page; Orbhoarder never sees your login." },
  { target: 'friends', view: 'friends', icon: 'fa-user-friends', title: 'Friends', body: "The friends' trade board (give away, sell to and ask the group) and <b>Build sharing</b>: your group's builds through GitHub." },
  { target: 'reference', view: 'reference', icon: 'fa-book', title: 'Reference', body: 'Cheat sheets for league mechanics, vendor and bench recipes, your league tracking (Thread planner, Challenges, checklist) and <b>Help</b>: how things work, where to find a build, common questions.' },
  { target: 'settings', view: 'settings', icon: 'fa-cog', title: 'Settings', body: 'Everything you can change. <b>Appearance</b> has the theme, text size and colour-blind-safe colours. <b>Take the tour</b> at the bottom runs this again.' },
  { target: 'feedback', icon: 'fa-bug', title: 'Bug / Idea', body: 'Something broken or a wish? Tell us here.' },
  {
    title: 'In game',
    icon: 'fa-gamepad',
    body: `Hover an item and press <b>${priceKey}</b> to price check it. <b>${overlayKey}</b> opens the overlay with all panels; Esc closes it. ` +
      'Orbhoarder never types into the game unless you click a button that says so. Have fun!'
  }
]

const step = ref(0)
const cur = computed(() => steps[step.value])
const rect = shallowRef<DOMRect | null>(null)
const cardEl = ref<HTMLElement>()
const nextEl = ref<HTMLElement>()
const CARD_W = 340

function targetEl (key?: string): HTMLElement | null {
  return key ? document.querySelector<HTMLElement>(`[data-tour="${key}"]`) : null
}

function measure () {
  const el = targetEl(cur.value.target)
  if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  // hidden (narrow window, second window): show the step in the middle
  const r = el?.getBoundingClientRect()
  rect.value = r && r.width > 0 ? r : null
}

const cardStyle = computed(() => {
  const r = rect.value
  const w = Math.min(CARD_W, window.innerWidth - 16)
  if (!r) return { width: `${w}px`, left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))
  return { width: `${w}px`, left: `${left}px`, top: `${r.bottom + 12}px` }
})

watch(step, async () => {
  if (cur.value.view) emit('view', cur.value.view)
  await nextTick()
  measure()
  nextEl.value?.focus()
}, { immediate: true })

function go (d: number) {
  step.value = Math.max(0, Math.min(steps.length - 1, step.value + d))
}
function close () {
  markTourSeen()
  tourOpen.value = false
}

function onKey (e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
  else return
  e.preventDefault()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', measure)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.tour-hole { box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6); }
html:not(.lg-motion-off) .tour-hole { transition: left 0.2s, top 0.2s, width 0.2s, height 0.2s; }
</style>
