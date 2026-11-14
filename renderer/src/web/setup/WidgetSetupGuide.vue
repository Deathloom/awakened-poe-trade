<template>
  <!-- Deathloom fork: first-run setup guide. On a new install it opens in the Loot
       Goblin window (main opens the window while pob.setupDone is unset), so it can
       be done before playing; the overlay shows it the first time it opens if it
       wasn't finished. Run again: Shift+Space bar (wand) or the window's Settings tab. -->
  <div v-if="desktop && visible" class="absolute inset-0 z-40 bg-black bg-opacity-60" />
  <div v-if="visible" :class="[$style.window, desktop ? 'z-50 border border-gray-600 shadow-lg' : '']" class="layout-column text-gray-100">
    <AppTitleBar @close="close" title="Loot Goblin setup" />
    <div class="flex grow min-h-0">
      <div class="pl-2 pt-2 bg-gray-900 flex flex-col gap-1 shrink-0" style="min-width: 11rem;">
        <button v-for="(s, i) of STEPS" :key="s"
          :class="[$style.step, { [$style.active]: i === step }]"
          @click="step = i">{{ i + 1 }}. {{ s }}</button>
      </div>
      <div class="grow layout-column bg-gray-900 min-w-0">
        <div class="grow overflow-y-auto bg-gray-800 rounded-tl p-4 text-base leading-snug">
          <!-- Deathloom fork: PoB download progress on every step until it's ready (not on Folders: shown there in full) -->
          <PobInstallStatus v-if="step !== 1" compact class="mb-3" />

          <!-- 1. Welcome + build sharing -->
          <template v-if="step === 0">
            <div class="text-xl mb-2">Welcome to Loot Goblin</div>
            <p v-if="desktop" class="mb-2">A few quick steps set up Loot Goblin. You don't need to be in game: everything you set
              here is used by the overlay and the in-game panels once you play. Every step can be skipped; run this guide again
              any time from this window's <b>Settings</b> tab, or in game: press <b>{{ overlayKey }}</b> and click <i class="fas fa-magic" />.</p>
            <p v-else class="mb-2">A few quick steps set up the overlay. Every step can be skipped and you can run this guide again
              any time: press <b>{{ overlayKey }}</b> and click <i class="fas fa-magic" /> on the top bar.</p>
            <p class="mb-3 text-gray-400">Loot Goblin is price checking, your Path of Building build next to every item,
              a campaign guide and a trade companion. It never types into the game unless you click a button that says so.</p>
            <div class="mb-1">Share builds with your group (optional)</div>
            <div class="text-gray-400 text-sm mb-2">
              Needs a free GitHub account that was invited to <b>POE-Builds</b>. Without it everything else still works.
            </div>
            <BuildSync class="rounded" @synced="probe()" />
            <div v-if="found?.existingPob" class="mt-3 p-2 rounded bg-gray-900">
              <div class="mb-1"><i class="fas fa-folder-open mr-1" />Found {{ found.existingPob.count }} build{{ found.existingPob.count === 1 ? '' : 's' }}
                from an earlier Path of Building in <span class="break-all text-gray-400">{{ found.existingPob.buildsDir }}</span></div>
              <div class="text-gray-400 text-sm mb-2">
                Copy them into Loot Goblin{{ found.player ? ` (your folder ${found.player})` : '' }}? The originals stay where they are;
                builds with the same name are skipped.
                <template v-if="found.player">If you're signed in with sync on, they're also uploaded to your folder in POE-Builds.</template>
                <template v-else>They stay on this PC (sign in above first if you want them shared).</template>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn" :disabled="copying" @click="copyBuilds">{{ copying ? 'Copying…' : 'Copy builds' }}</button>
                <span v-if="copyResult" class="text-sm" :class="copyResult.ok ? 'text-green-500' : 'text-red-400'">{{ copyResult.text }}</span>
              </div>
            </div>
            <div class="mt-3 text-sm text-gray-400">
              Not in POE-Builds yet?
              <button class="btn ml-1" @click="requestAccess"><i class="fab fa-github mr-1" />Request access</button>
              <div class="mt-1 text-gray-500">Opens a short form on GitHub (sign in there, then Submit). Once it's approved
                you get an email invite from GitHub: accept it, then sign in above.</div>
            </div>
          </template>

          <!-- 2. Folders -->
          <template v-else-if="step === 1">
            <div class="text-xl mb-2">Game log and Path of Building</div>
            <div class="mb-3">
              <div class="mb-1">Game log (Client.txt)</div>
              <div v-if="found?.clientLog" class="text-green-500 text-sm mb-1 break-all"><i class="fas fa-check mr-1" />Found: {{ found.clientLog }}</div>
              <div v-else class="text-yellow-500 text-sm mb-1">Not found yet. It's found automatically once the game is running
                (start PoE, then press <b>Check again</b>), or type the path below.</div>
              <input v-model.trim="clientLog"
                class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic"
                placeholder="Empty = find it by itself (e.g. C:\Games\Path of Exile\logs\Client.txt)">
              <div class="text-gray-500 text-sm mt-1">Used by the campaign guide, trade companion and "follow my character".</div>
            </div>
            <div class="mb-3">
              <PobInstallStatus v-if="!pob.pobDir" class="mb-2" />
              <div class="mb-1">Path of Building folder</div>
              <div v-if="found" class="text-sm mb-1 break-all" :class="found.pobOk ? 'text-green-500' : 'text-red-400'">
                <i class="fas mr-1" :class="found.pobOk ? 'fa-check' : 'fa-times'" />
                {{ found.pobOk ? 'Working: ' + found.pobDir : (found.pobDir ? 'No runtime\\PoBHeadless.exe in ' + found.pobDir : 'No Path of Building found') }}
              </div>
              <div class="flex gap-1">
                <input v-model.trim="pob.pobDir"
                  class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic"
                  placeholder="Empty = Loot Goblin's own Path of Building (downloads by itself)">
                <button class="btn" @click="browse('pobDir')">Browse…</button>
              </div>
            </div>
            <div class="mb-3">
              <div class="mb-1">Builds folder</div>
              <div class="flex gap-1">
                <input v-model.trim="pob.buildsDir"
                  class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic"
                  :placeholder="found?.buildsDir ? 'Empty = ' + found.buildsDir : 'Empty = default'">
                <button class="btn" @click="browse('buildsDir')">Browse…</button>
              </div>
            </div>
            <div class="mb-3">
              <div class="mb-1">Player folder</div>
              <input v-model.trim="pob.player"
                class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic"
                :placeholder="found?.player ? 'Empty = ' + found.player + ' (from build sharing)' : 'Empty = the builds folder itself'">
              <div class="text-gray-500 text-sm mt-1">Your folder in the builds folder. Leave the three fields empty unless
                you run your own copy of Path of Building.</div>
            </div>
            <ui-toggle v-model="pob.enabled">Show what an item does to my build when price-checking</ui-toggle>
            <div class="mt-3"><button class="btn" @click="probe()">Check again</button></div>
          </template>

          <!-- 3. Character -->
          <template v-else-if="step === 2">
            <div class="text-xl mb-2">Your character</div>
            <p class="mb-2 text-gray-400">Loot Goblin compares items, gems and the passive tree with your
              Path of Building build. Comparing with your live character (what it wears now) is turned off:
              GGG's rules don't allow shared apps to read character data from pathofexile.com outside its
              official API, and we don't risk anyone's account.</p>
            <p class="mb-2 text-gray-400">Keep your build in PoB up to date (re-import your character in PoB
              and save) and the panels follow it.</p>
          </template>

          <!-- 4. Panels -->
          <template v-else-if="step === 3">
            <div class="text-xl mb-2">Panels while you play</div>
            <p class="mb-3 text-gray-400">Pinned panels stay on screen over the game in a small window that never takes
              focus from the game. Each hotkey opens and closes its panel. Pinned panels start closed.</p>
            <table class="mb-3">
              <tr class="text-gray-500 text-sm">
                <td class="pr-4"></td><td class="pr-4">Hotkey</td><td class="pr-4">Pinned</td><td>Clicks go through</td>
              </tr>
              <tr v-for="p of PANELS" :key="p.key">
                <td class="pr-4 py-1">{{ p.label }}</td>
                <td class="pr-4"><hotkey-input v-model="pob[p.hotkey]" class="w-40" /></td>
                <td class="pr-4"><ui-toggle v-model="pob.hud[p.key]" /></td>
                <td><ui-toggle v-if="pob.hud[p.key]" v-model="pob.hud.clickThroughPanels[p.key]" /></td>
              </tr>
              <tr>
                <td class="pr-4 py-1">Open Path of Building</td>
                <td class="pr-4"><hotkey-input v-model="pob.openPobKey" class="w-40" /></td>
              </tr>
            </table>
            <div class="text-gray-500 text-sm mb-3">"Clicks go through" means the panel can't be clicked while you play
              (press {{ overlayKey }} to click it). Drag a panel by its top bar; resize it from the bottom-right corner.</div>
            <template v-if="pob.hud.guide || pob.hud.trades || pob.hud.gear">
              <ui-toggle v-model="pob.hud.opaque" class="mb-1">Solid background (no see-through window)</ui-toggle>
              <div class="flex items-center gap-2 mb-1" style="max-width: 24rem;">
                <span class="shrink-0">Opacity</span>
                <input v-model.number="pob.hud.opacity" type="range" min="30" max="100" step="5" class="flex-1">
                <span class="w-10 text-right">{{ pob.hud.opacity }}%</span>
              </div>
              <div class="text-gray-500 text-sm">Set the game's Display mode to <b>Windowed Fullscreen</b>.
                If the game ever crashes with a panel pinned, try Solid background.</div>
            </template>
          </template>

          <!-- 5. Trade companion -->
          <template v-else-if="step === 4">
            <div class="text-xl mb-2">Trade companion</div>
            <p class="mb-3 text-gray-400">Opens when someone whispers you to buy something. Buttons: Invite, Trade, Thanks,
              Kick, Sold, Busy (and Hideout / Thanks when you're buying).</p>
            <div class="mb-1">The buttons should…</div>
            <div class="flex flex-col gap-1 mb-3">
              <label class="cursor-pointer"><input type="radio" value="copy" v-model="pob.chatButtons" class="mr-2">
                copy the chat command (you paste it in chat with Enter, Ctrl+V)</label>
              <label class="cursor-pointer"><input type="radio" value="send" v-model="pob.chatButtons" class="mr-2">
                send it to game chat (one command per click, like a chat hotkey)</label>
            </div>
            <ui-toggle v-model="pob.hud.autoHideTrades">Open on a trade whisper, close when no trades are left</ui-toggle>
            <div class="text-gray-500 text-sm mt-1">Only applies when the trade companion is pinned (previous step).
              The Ledger tab keeps your sales and buys per league.</div>
          </template>

          <!-- 6. Optional -->
          <template v-else-if="step === 5">
            <div class="text-xl mb-2">Optional extras</div>
            <div class="mb-3">
              <div class="mb-1"><i class="fas fa-chart-line mr-1" />Market history</div>
              <div class="text-gray-400 text-sm">Click the star ☆ next to the poe.ninja price in a price check. The market
                history panel then shows its 7-day trend plus prices Loot Goblin records while it runs. Nothing to set up.</div>
            </div>
            <div class="mb-3">
              <ui-toggle :modelValue="pob.startWithWindows !== false" @update:modelValue="pob.startWithWindows = $event">Start Loot Goblin with Windows</ui-toggle>
              <div class="text-gray-400 text-sm mt-1">Starts in the tray when you sign in to Windows, so it's ready
                before you launch the game.</div>
            </div>
            <div class="mb-3">
              <ui-toggle :modelValue="pob.errorReports !== false" @update:modelValue="pob.errorReports = $event">Send problem reports automatically</ui-toggle>
              <div class="text-gray-400 text-sm mt-1">When something breaks, Loot Goblin opens an issue in the group's private
                repo with your GitHub sign-in (version, error, last log lines; no Windows user folder). Only when signed in.
                Tray icon → Report a problem… for anything else.</div>
            </div>
          </template>

          <!-- 7. Done -->
          <template v-else>
            <div class="text-xl mb-2">All set</div>
            <ul class="list-disc pl-5 space-y-1">
              <li><b>{{ overlayKey }}</b>: open / close the overlay. Esc closes it.</li>
              <li><b>{{ priceKey }}</b> over an item in game: price check, with what it does to your build.</li>
              <li><b>{{ pob.gearPanelKey || 'no hotkey' }}</b> build gear, <b>{{ pob.guideKey || 'no hotkey' }}</b> campaign guide,
                <b>{{ pob.tradesKey || 'no hotkey' }}</b> trade companion, <b>{{ pob.openPobKey || 'no hotkey' }}</b> Path of Building.</li>
              <li>Build panel: <i class="fas fa-cloud" /> build sharing (Pull / Push), <i class="fas fa-file-import" /> import a PoB code or link,
                <i class="fas fa-exchange-alt" /> pick the build and loadout.</li>
              <li><i class="fas fa-question-circle" /> on the top bar is a short how-to, <i class="fas fa-magic" /> runs this guide again.</li>
              <li>Something wrong? Tray icon → Report a problem…</li>
            </ul>
            <div class="text-gray-500 text-sm mt-3">
              Loot Goblin is not affiliated with or endorsed by Grinding Gear Games. It reads the game's log file and your clipboard,
              never game memory, never buys anything by itself, and only sends a chat command when you click a button.
            </div>
          </template>
        </div>
        <div class="border-t bg-gray-900 border-gray-600 p-2 flex items-center gap-x-2">
          <span class="text-gray-500 text-sm">Changes are used right away.</span>
          <button v-if="step > 0" class="btn ml-auto" @click="step--">Back</button>
          <button v-if="step < STEPS.length - 1" class="btn" :class="{ 'ml-auto': step === 0 }" @click="step++">
            {{ step === 0 ? 'Start' : 'Next' }}</button>
          <button v-else class="btn" @click="close">Finish</button>
          <button v-if="step < STEPS.length - 1" class="px-2 text-gray-500" @click="close">Skip setup</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { WidgetSpec, Widget as WidgetT } from '../overlay/interfaces'

export default {
  widget: {
    type: 'setup-guide',
    instances: 'single',
    initInstance: (): WidgetT => ({
      wmId: 0,
      wmType: 'setup-guide',
      wmTitle: '{icon=fa-magic}',
      wmWants: 'hide',
      wmZorder: 'exclusive',
      wmFlags: ['invisible-on-blur', 'menu::skip']
    })
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref, watch } from 'vue'
import type { IpcEventPayload } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig, pushHostConfig, saveConfig, defaultPobConfig, defaultHudConfig } from '@/web/Config'
import type { WidgetManager, PriceCheckWidget } from '../overlay/interfaces'
import AppTitleBar from '@/web/ui/AppTitlebar.vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import HotkeyInput from '@/web/settings/HotkeyInput.vue'
import BuildSync from '@/web/pob/BuildSync.vue'
import PobInstallStatus from '@/web/pob/PobInstallStatus.vue'
import { IS_HUD } from '@/web/hud/is-hud'
import { desktopSetupShown } from './setup-state'

// desktop: shown in the Loot Goblin window (no widget manager; saves itself)
const props = defineProps<{ config?: WidgetT, desktop?: boolean }>()
const wm = props.desktop ? null : inject<WidgetManager>('wm')!
const visible = computed(() => props.desktop ? desktopSetupShown.value : props.config?.wmWants === 'show')

const STEPS = ['Welcome', 'Folders', 'Character', 'Panels', 'Trades', 'Extras', 'Done']
const PANELS = [
  { key: 'guide', label: 'Campaign guide', hotkey: 'guideKey' },
  { key: 'trades', label: 'Trade companion', hotkey: 'tradesKey' },
  { key: 'gear', label: 'Build gear', hotkey: 'gearPanelKey' }
] as const

const step = ref(0)

const pob = computed(() => {
  const cfg = AppConfig()
  cfg.pob ??= defaultPobConfig()
  cfg.pob.hud ??= defaultHudConfig()
  cfg.pob.hud.clickThroughPanels ??= defaultHudConfig().clickThroughPanels
  return cfg.pob
})
const clientLog = computed({
  get: () => AppConfig().clientLog ?? '',
  set: (v: string) => { AppConfig().clientLog = v || null }
})
const overlayKey = computed(() => AppConfig().overlayKey)
const priceKey = computed(() => {
  const pc = AppConfig<PriceCheckWidget>('price-check')
  return pc?.hotkey ? `${pc.hotkeyHold} + ${pc.hotkey}` : 'the price check hotkey'
})

// Shows once by itself: in the Loot Goblin window on a new install, else the
// first time the overlay is opened
if (props.desktop) {
  if (!pob.value.setupDone) desktopSetupShown.value = true
} else if (!IS_HUD && wm) {
  watch(wm.active, (active) => {
    if (!active || pob.value.setupDone) return
    pob.value.setupDone = true
    step.value = 0
    wm.show(props.config!.wmId)
  }, { immediate: true })
}

// Run again (top bar / Settings tab)
watch(visible, (shown) => {
  if (shown) {
    step.value = 0
    probe()
  }
}, { immediate: true })

// Changes apply right away (main gets them; the overlay saves when this closes)
let pushTimer: ReturnType<typeof setTimeout> | null = null
watch(() => JSON.stringify([AppConfig().pob, AppConfig().clientLog]), () => {
  if (!visible.value) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    pushHostConfig()
    // the window saves its own changes (the overlay saves when the guide closes)
    if (props.desktop) saveConfig()
    probe()
  }, 600)
})

function close () {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
    pushHostConfig()
  }
  pob.value.setupDone = true
  if (props.desktop) {
    saveConfig()
    pushHostConfig()
    desktopSetupShown.value = false
  } else {
    wm!.hide(props.config!.wmId)
  }
}

// What main found (Client.txt, PoB, builds, player; characters with an account name)
type Probe = IpcEventPayload<'MAIN->CLIENT::pob-setup-probe'>
const found = ref<Probe | null>(null)
let nextId = 1
const pending = new Map<number, (p: Probe) => void>()
const listener = Host.onEvent('MAIN->CLIENT::pob-setup-probe', (e) => {
  const done = pending.get(e.requestId)
  if (!done) return
  pending.delete(e.requestId)
  done(e)
})
onUnmounted(() => { listener.abort() })

function request (accountName?: string): Promise<Probe> {
  const requestId = nextId++
  return new Promise((resolve) => {
    pending.set(requestId, resolve)
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-setup-probe', payload: { requestId, accountName } })
  })
}

function probe () {
  request().then((p) => { found.value = p }).catch(() => {})
}

// Builds of an earlier PoB install -> player folder (main picks the source folder itself)
const copying = ref(false)
const copyResult = ref<{ ok: boolean, text: string } | null>(null)
function copyBuilds () {
  if (copying.value) return
  copying.value = true
  copyResult.value = null
  const requestId = nextId++
  const listener = Host.onEvent('MAIN->CLIENT::pob-copy-builds', (e) => {
    if (e.requestId !== requestId) return
    listener.abort()
    copying.value = false
    copyResult.value = e.ok
      ? { ok: true, text: `Copied ${e.copied ?? 0}${e.skipped ? `, ${e.skipped} already there` : ''}.` }
      : { ok: false, text: e.error ?? 'Copy failed' }
    probe()
  })
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-copy-builds', payload: { requestId } })
}

// Public repo where join requests are filed; approving one invites the person (GitHub Action)
function requestAccess () {
  window.open('https://github.com/POE-Builds/access/issues/new?template=join.yml')
}

function browse (field: 'pobDir' | 'buildsDir') {
  const requestId = nextId++
  const listener = Host.onEvent('MAIN->CLIENT::pob-pick-folder', (e) => {
    if (e.requestId !== requestId) return
    listener.abort()
    if (e.path) pob.value[field] = e.path
  })
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-pick-folder',
    payload: {
      requestId,
      title: field === 'pobDir' ? 'Path of Building folder' : 'Builds folder',
      defaultPath: pob.value[field] || (field === 'pobDir' ? found.value?.pobDir : found.value?.buildsDir) || ''
    }
  })
}
</script>

<style lang="postcss" module>
.window {
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  margin: auto;
  max-width: 50rem;
  max-height: 36rem;
  overflow: hidden;
  @apply bg-gray-800 rounded;
}
.step {
  text-align: left;
  @apply p-2 text-gray-600 rounded-l;
  line-height: 1;
  &:hover { @apply text-gray-100; }
  &.active { @apply text-gray-300 bg-gray-800; }
}
</style>

<style lang="postcss" scoped>
.btn {
  @apply px-3 bg-gray-700 rounded text-gray-200;
  &:hover:not(:disabled) { @apply text-white; }
  &:disabled { @apply opacity-50; }
}
</style>
