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
    <div class="mb-2">
      <div class="flex-1 mb-1">Path of Building folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.pobDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. D:\Claude Projects\PathOfBuilding">
        <button type="button" @click="browsePobDir" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">The folder that contains <code>src</code> and <code>runtime\PoBHeadless.exe</code>.</div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Builds folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.buildsDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. D:\Claude Projects\poe-builds\poe1">
        <button type="button" @click="browseBuildsDir" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Player</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.player"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. Deathloom">
        <button type="button" @click="browsePlayer" class="px-2 bg-gray-800 rounded shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">
        Your folder in the builds folder (Browse… picks it and fills in the name). Its <code>active.txt</code> names the build to compare against.
        Changes are picked up automatically after a Pull in PoB.
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
      <div class="text-gray-500 text-sm mb-1">
        Each hotkey shows or hides its panel. A pinned panel (Show while playing, below) toggles over
        the game without opening the overlay. Defaults: Ctrl+G, Ctrl+H, Ctrl+T.
      </div>
      <div class="text-gray-500 text-sm">
        Shows the active build's items in the overlay (also in the widget menu, hammer icon).
        Copy puts the unique name or base type on the clipboard for the in-game market
        (press <code>/</code>, then Ctrl+V); the app never types into the game.
        The same Copy button is on the price check window.
      </div>
    </div>
    <div class="mt-4 mb-2">
      <ui-toggle v-model="pob.liveGear">Also compare with my equipped gear</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Reads your character's gear from your public Characters tab on pathofexile.com
        (no login; at most once every 2 minutes, or when you press refresh in the panel).
        Your profile's Characters tab must be public. PoB's config (enemy, buffs, bandit, pantheon)
        always comes from the build.
      </div>
    </div>
    <template v-if="pob.liveGear || pob.stash.enabled">
      <div class="mb-2">
        <div class="flex-1 mb-1">Account name</div>
        <input v-model.trim="pob.accountName"
          class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. Deathloom#1234">
        <div class="text-gray-500 text-sm mt-1">Including the <code>#1234</code> part, as shown on your profile.</div>
      </div>
    </template>
    <template v-if="pob.liveGear">
      <div class="mb-2">
        <div class="flex-1 mb-1">Character</div>
        <input v-model.trim="pob.character"
          class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. DeathloomAW">
      </div>
      <div class="mb-2">
        <ui-toggle v-model="pob.liveTreeAndGems">Use the character's passive tree, level and gems too</ui-toggle>
        <div class="text-gray-500 text-sm mt-1">
          On: "vs character" is your actual character (one extra request per refresh for the tree).
          Off: only the items are swapped into the build. The main skill is the build's main skill
          if the character has it, otherwise PoB's guess.
        </div>
      </div>
    </template>

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
          <span class="flex-1">Each panel has its own spot: drag its grip to move it.</span>
          <button type="button" class="px-2 bg-gray-800 rounded" @click="resetHudPositions">Reset positions</button>
        </div>
      </template>
    </div>

    <div class="mt-6 mb-2">
      <ui-toggle v-model="pob.stash.enabled">Stash tracker (personal, uses your login cookie)</ui-toggle>
      <div class="text-yellow-500 text-sm mt-1">
        Grey area: GGG's official stash API needs an approved app and registration is closed, so this reads
        your tabs the way the website's stash viewer does, with your POESESSID. Read-only, refresh by hand only,
        a few tabs at a time. Never share your POESESSID: anyone with it is logged in as you.
      </div>
    </div>
    <template v-if="pob.stash.enabled">
      <div class="mb-2">
        <div class="flex-1 mb-1">League</div>
        <input v-model.trim="pob.stash.league"
          class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. Keepers (exactly as on the trade site)">
      </div>
      <div class="mb-2">
        <div class="flex-1 mb-1">POESESSID</div>
        <div class="flex gap-1">
          <input v-model.trim="sessionInput" type="password" autocomplete="off"
            class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" placeholder="paste to replace the saved one">
          <button type="button" class="px-2 bg-gray-800 rounded shrink-0" :disabled="!sessionInput" @click="saveSession">Save</button>
          <button type="button" class="px-2 bg-gray-800 rounded shrink-0" @click="forgetSession">Forget</button>
        </div>
        <div class="text-gray-500 text-sm mt-1">
          From pathofexile.com while logged in: browser dev tools → Application → Cookies → POESESSID.
          Saved encrypted on this PC (Windows DPAPI), not in the settings file, and only sent to pathofexile.com.
          It changes when you log out; paste the new one then.
          <span v-if="sessionNote" class="text-green-500">{{ sessionNote }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import HotkeyInput from './HotkeyInput.vue'
import { configProp } from './utils'
import { defaultPobConfig, defaultHudConfig } from '@/web/Config'
import { Host } from '@/web/background/IPC'

export default defineComponent({
  name: 'Path of Building',
  components: { UiToggle, HotkeyInput },
  props: configProp(),
  setup (props) {
    const pob = computed(() => {
      props.config.pob ??= defaultPobConfig()
      props.config.pob.stash ??= defaultPobConfig().stash
      props.config.pob.chatButtons ??= 'copy'
      props.config.pob.hud ??= defaultHudConfig()
      props.config.pob.hud.clickThroughPanels ??= defaultHudConfig().clickThroughPanels
      if (props.config.pob.guideKey === undefined) props.config.pob.guideKey = null
      if (props.config.pob.tradesKey === undefined) props.config.pob.tradesKey = null
      return props.config.pob
    })

    const sessionInput = ref('')
    const sessionNote = ref('')
    function sendSession (sessionId: string | null) {
      Host.sendEvent({ name: 'CLIENT->MAIN::stash-session', payload: { sessionId } })
    }

    let nextId = 1
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

    return {
      pob,
      HUD_PANELS: [
        { key: 'guide', label: 'Campaign guide', hotkey: 'guideKey' },
        { key: 'trades', label: 'Trade companion', hotkey: 'tradesKey' },
        { key: 'gear', label: 'Build gear', hotkey: 'gearPanelKey' }
      ] as const,
      // applied when the settings window is closed, like every other setting
      resetHudPositions () {
        pob.value.hud.pos = defaultHudConfig().pos
      },
      sessionInput,
      sessionNote,
      saveSession () {
        if (!sessionInput.value) return
        sendSession(sessionInput.value)
        sessionInput.value = ''
        sessionNote.value = 'Saved.'
      },
      forgetSession () {
        sendSession(null)
        sessionNote.value = 'Removed.'
      },
      async browsePobDir () {
        const picked = await pickFolder('Path of Building folder', pob.value.pobDir)
        if (picked) pob.value.pobDir = picked
      },
      async browseBuildsDir () {
        const picked = await pickFolder('Builds folder (poe-builds\\poe1)', pob.value.buildsDir)
        if (picked) pob.value.buildsDir = picked
      },
      async browsePlayer () {
        const start = pob.value.player
          ? joinPath(pob.value.buildsDir, pob.value.player)
          : pob.value.buildsDir
        const picked = await pickFolder('Your player folder', start)
        if (!picked) return
        const parent = picked.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
        // a player folder outside the current builds folder moves the builds folder too
        if (parent.toLowerCase() !== pob.value.buildsDir.replace(/[\\/]+$/, '').toLowerCase()) {
          pob.value.buildsDir = parent
        }
        pob.value.player = baseName(picked)
      }
    }
  }
})
</script>
