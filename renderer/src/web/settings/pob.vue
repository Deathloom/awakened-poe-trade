<template>
  <!-- Deathloom fork: Path of Building build impact settings -->
  <div class="max-w-md p-2">
    <div class="mb-4">
      <ui-toggle v-model="pob.enabled">Show build impact when price-checking</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Runs Path of Building in the background and shows what an item does to your active build
        (the same numbers as PoB's item tooltip).
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.startWithWindows !== false" @update:modelValue="pob.startWithWindows = $event">Start Loot Goblin with Windows</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Starts in the tray when you sign in to Windows, so hotkeys, the HUD and updates are ready before the game.
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.desktopAtStart === true" @update:modelValue="pob.desktopAtStart = $event">Open the Loot Goblin window when the game starts</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        A normal window with all panels (build, guide, trades, market) for a second screen. Also from the tray:
        double-click the icon or "Open Loot Goblin window". It remembers its screen, position and size.
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.errorReports !== false" @update:modelValue="pob.errorReports = $event">Send problem reports automatically</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        When Loot Goblin or its Path of Building hits an error, it opens an issue in the group's private
        POE-Builds/poe-builds repo with your GitHub sign-in (build sharing): version, error and the last log lines,
        without your Windows user folder. Not sent when you're not signed in. Tray → Report a problem… for anything else.
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Path of Building folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.pobDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.pobDir ? `Default: ${defaults.pobDir}` : 'e.g. C:\\Games\\PathOfBuilding'">
        <button type="button" @click="browsePobDir" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">
        The folder that contains <code>src</code> and <code>runtime\PoBHeadless.exe</code>.
        Leave empty to use Loot Goblin's own Path of Building (downloaded once, keeps itself up to date; tray menu → Open Path of Building).
      </div>
      <PobInstallStatus v-if="!pob.pobDir" class="mt-2" />
      <!-- Deathloom fork: bring builds over from another Path of Building -->
      <div class="mt-2 p-2 rounded bg-gray-900">
        <div class="mb-1"><i class="fas fa-file-import mr-1" />Copy builds from another Path of Building</div>
        <div class="text-gray-500 text-sm mb-2">
          <template v-if="existingPob">Found {{ existingPob.count }} build{{ existingPob.count === 1 ? '' : 's' }} in
            <span class="break-all text-gray-400">{{ existingPob.buildsDir }}</span>.</template>
          <template v-else>No other Path of Building found in Documents. Pick its builds folder yourself.</template>
          Copied into your Loot Goblin builds{{ defaults.player || pob.player ? ` (folder ${pob.player || defaults.player})` : '' }}; the originals stay
          where they are, builds with the same name are skipped. With build sync on, they're uploaded too.
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="px-2 bg-gray-800 rounded" :disabled="copying || !existingPob" @click="copyBuilds()">{{ copying ? 'Copying…' : 'Copy builds' }}</button>
          <button type="button" class="px-2 bg-gray-800 rounded" :disabled="copying" @click="copyFromFolder">Choose folder…</button>
          <span v-if="copyResult" class="text-sm" :class="copyResult.ok ? 'text-green-500' : 'text-red-400'">{{ copyResult.text }}</span>
        </div>
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Builds folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.buildsDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.buildsDir ? `Default: ${defaults.buildsDir}` : 'e.g. C:\\Games\\poe-builds\\poe1'">
        <button type="button" @click="browseBuildsDir" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">Leave empty for the builds folder of Loot Goblin's own Path of Building.</div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Player</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.player"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.player ? `Default: ${defaults.player}` : 'your GitHub name (empty: no player folder)'">
        <button type="button" @click="browsePlayer" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">
        Your folder in the builds folder (Browse… picks it and fills in the name). Its <code>active.txt</code> names the build to compare against.
        Changes are picked up automatically after a Pull in PoB.
        Leave empty to use the player folder from PoB's build sharing (Sync…), or the builds folder itself if you don't share builds.
      </div>
    </div>
    <div class="mt-4 mb-2">
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Build gear panel hotkey</span>
        <hotkey-input v-model="pob.gearPanelKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Campaign guide hotkey</span>
        <hotkey-input v-model="pob.guideKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Trade companion hotkey</span>
        <hotkey-input v-model="pob.tradesKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Open Path of Building hotkey</span>
        <hotkey-input v-model="pob.openPobKey" class="w-48" />
      </div>
      <div class="text-gray-500 text-sm mb-1">
        Each hotkey shows or hides its panel. A pinned panel (Show while playing, below) toggles over
        the game without opening the overlay. Defaults: Ctrl+G, Ctrl+H, Ctrl+T; Ctrl+P opens Path of Building.
      </div>
      <div class="text-gray-500 text-sm">
        Shows the active build's items in the overlay (also in the widget menu, hammer icon).
        Copy puts the unique name or base type on the clipboard for the in-game market
        (press <code>/</code>, then Ctrl+V); the app never types into the game.
        The same Copy button is on the price check window.
      </div>
    </div>
    <div class="mt-4 mb-2 text-gray-500 text-sm">
      Comparing with your live character (equipped gear, tree, gems, following the character you play) is
      turned off: GGG's rules don't allow shared apps to read character data from pathofexile.com outside
      its official API. Everything compares with your PoB build. It can come back once GGG reopens app
      registration for its official API.
    </div>

    <div class="mt-6 mb-2">
      <div class="mb-1">Chat buttons (trade companion)</div>
      <select v-model="pob.chatButtons" class="rounded bg-gray-900 px-1">
        <option value="copy">Copy the command (paste it in chat yourself)</option>
        <option value="send">Send it to game chat</option>
      </select>
      <div class="text-gray-500 text-sm mt-1">
        Send: each click focuses the game and sends exactly one chat command (e.g. <code>/invite name</code>),
        the same as a chat hotkey. Nothing is ever sent without a click.
      </div>
    </div>

    <div class="mt-6 mb-2">
      <ui-toggle :modelValue="pob.tradeLinksInWindow !== false" @update:modelValue="v => pob.tradeLinksInWindow = v">
        Open Trade buttons in the Loot Goblin window (Trade site tab)</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        The official trade site in its own tab, signed in separately from your browser (sign in on GGG's own page;
        Loot Goblin never sees your login). Off: Trade buttons open your browser as before.
      </div>
    </div>

    <div class="mt-6 mb-2">
      <div class="mb-1">Show while playing</div>
      <div class="text-gray-500 text-sm mb-2">
        Pinned panels stay on screen while the game has focus, in a small window of their own that never
        takes focus from the game. Drag the grip at the top to move it. Unpinned panels only show with
        the overlay active (Shift+Space). If the game crashes with a panel pinned, try "Solid background",
        and make sure the game's Display mode is <b>Windowed Fullscreen</b>.
      </div>
      <table class="mb-2">
        <tr class="text-gray-500 text-sm">
          <td class="pr-4"></td><td class="pr-4">Pinned</td><td>Clicks go through while playing</td>
        </tr>
        <tr v-for="p of HUD_PANELS" :key="p.key">
          <td class="pr-4 py-0.5">{{ p.label }} <span class="text-gray-500 text-sm">({{ pob[p.hotkey] || 'no hotkey' }})</span></td>
          <td class="pr-4"><ui-toggle v-model="pob.hud[p.key]" /></td>
          <td><ui-toggle v-if="pob.hud[p.key]" v-model="pob.hud.clickThroughPanels[p.key]" /></td>
        </tr>
      </table>
      <div class="text-gray-500 text-sm mb-2">
        Pinned panels start closed: open and close them with their hotkey. Clicks going through means you can't
        press that panel's buttons while you play (Shift+Space makes them clickable).
      </div>
      <template v-if="pob.hud.trades">
        <ui-toggle v-model="pob.hud.autoHideTrades" class="mb-1">Trade companion opens on a trade whisper and closes when no trades are left</ui-toggle>
      </template>
      <template v-if="pob.hud.guide || pob.hud.trades || pob.hud.gear">
        <ui-toggle v-model="pob.hud.opaque" class="mb-1">Solid background (no see-through window)</ui-toggle>
        <div class="flex items-center gap-2 mb-1">
          <span class="shrink-0">Opacity</span>
          <input v-model.number="pob.hud.opacity" type="range" min="30" max="100" step="5" class="flex-1">
          <span class="w-10 text-right">{{ pob.hud.opacity }}%</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="flex-1">Drag a panel's top bar to move it, its bottom-right corner to resize it.</span>
          <button type="button" class="px-2 bg-gray-800 rounded" @click="resetHudPositions">Reset positions and sizes</button>
        </div>
      </template>
    </div>

  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import HotkeyInput from './HotkeyInput.vue'
import PobInstallStatus from '@/web/pob/PobInstallStatus.vue'
import { configProp } from './utils'
import { defaultPobConfig, defaultHudConfig } from '@/web/Config'
import { Host } from '@/web/background/IPC'

export default defineComponent({
  name: 'Path of Building',
  components: { UiToggle, HotkeyInput, PobInstallStatus },
  props: configProp(),
  setup (props) {
    const pob = computed(() => {
      props.config.pob ??= defaultPobConfig()
      props.config.pob.chatButtons ??= 'copy'
      props.config.pob.hud ??= defaultHudConfig()
      props.config.pob.hud.clickThroughPanels ??= defaultHudConfig().clickThroughPanels
      if (props.config.pob.guideKey === undefined) props.config.pob.guideKey = null
      if (props.config.pob.tradesKey === undefined) props.config.pob.tradesKey = null
      if (props.config.pob.openPobKey === undefined) props.config.pob.openPobKey = null
      return props.config.pob
    })

    let nextId = 1

    // What empty fields fall back to (bundled PoB, Documents\Loot Goblin\Builds, PoB's sync player)
    const defaults = ref({ pobDir: '', buildsDir: '', player: '' })
    {
      const requestId = nextId++
      const listener = Host.onEvent('MAIN->CLIENT::pob-defaults', (e) => {
        if (e.requestId !== requestId) return
        listener.abort()
        defaults.value = { pobDir: e.pobDir, buildsDir: e.buildsDir, player: e.player }
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-defaults', payload: { requestId } })
    }
    const buildsDir = () => pob.value.buildsDir || defaults.value.buildsDir
    function pickFolder (title: string, defaultPath: string): Promise<string | null> {
      const requestId = nextId++
      return new Promise((resolve) => {
        const listener = Host.onEvent('MAIN->CLIENT::pob-pick-folder', (e) => {
          if (e.requestId !== requestId) return
          listener.abort()
          resolve(e.path)
        })
        Host.sendEvent({
          name: 'CLIENT->MAIN::pob-pick-folder',
          payload: { requestId, title, defaultPath }
        })
      })
    }

    function joinPath (dir: string, name: string) {
      return dir ? dir.replace(/[\\/]+$/, '') + '\\' + name : name
    }
    function baseName (p: string) {
      return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
    }

    // Builds of an earlier Path of Building (found in Documents) or a folder the player picks
    const existingPob = ref<{ buildsDir: string, count: number } | null>(null)
    function probeExisting () {
      const requestId = nextId++
      const listener = Host.onEvent('MAIN->CLIENT::pob-setup-probe', (e) => {
        if (e.requestId !== requestId) return
        listener.abort()
        existingPob.value = e.existingPob ?? null
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-setup-probe', payload: { requestId } })
    }
    probeExisting()
    const copying = ref(false)
    const copyResult = ref<{ ok: boolean, text: string } | null>(null)
    function copyBuilds (source?: string) {
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
        probeExisting()
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-copy-builds', payload: { requestId, source } })
    }

    return {
      pob,
      defaults,
      existingPob,
      copying,
      copyResult,
      copyBuilds,
      async copyFromFolder () {
        const picked = await pickFolder('Builds folder of the other Path of Building', existingPob.value?.buildsDir ?? '')
        if (picked) copyBuilds(picked)
      },
      HUD_PANELS: [
        { key: 'guide', label: 'Campaign guide', hotkey: 'guideKey' },
        { key: 'trades', label: 'Trade companion', hotkey: 'tradesKey' },
        { key: 'gear', label: 'Build gear', hotkey: 'gearPanelKey' }
      ] as const,
      // applied when the settings window is closed, like every other setting
      resetHudPositions () {
        pob.value.hud.pos = defaultHudConfig().pos
        pob.value.hud.dims = {}
      },
      async browsePobDir () {
        const picked = await pickFolder('Path of Building folder', pob.value.pobDir || defaults.value.pobDir)
        if (picked) pob.value.pobDir = picked
      },
      async browseBuildsDir () {
        const picked = await pickFolder('Builds folder (poe-builds\\poe1)', buildsDir())
        if (picked) pob.value.buildsDir = picked
      },
      async browsePlayer () {
        const player = pob.value.player || defaults.value.player
        const start = player ? joinPath(buildsDir(), player) : buildsDir()
        const picked = await pickFolder('Your player folder', start)
        if (!picked) return
        const parent = picked.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
        // a player folder outside the current builds folder moves the builds folder too
        if (parent.toLowerCase() !== buildsDir().replace(/[\\/]+$/, '').toLowerCase()) {
          pob.value.buildsDir = parent
        }
        pob.value.player = baseName(picked)
      }
    }
  }
})
</script>
