<template>
  <!-- Deathloom fork: where the app's panels show (overlay, over the game, Orbhoarder window) -->
  <div class="max-w-md p-2">
    <div class="text-gray-500 text-sm mb-2">
      Panel hotkeys are in Settings → Hotkeys.
    </div>
    <div class="mb-2">
      <div class="mb-1">Where panels show</div>
      <div class="text-gray-500 text-sm mb-2">
        Pick for each panel where you want it: <b>In game</b> (a small window over the game, below),
        the <b>overlay</b> (Shift+Space and its menu) and/or the <b>Orbhoarder window</b> (its All tab; arrange it there with Edit layout).
        A panel that's in neither In game nor the overlay opens the Orbhoarder window when you press its hotkey.
      </div>
      <table class="mb-2">
        <tr class="text-gray-500 text-sm">
          <td class="pr-4"></td><td class="pr-4">In game</td><td class="pr-4">Overlay</td><td>Orbhoarder window</td>
        </tr>
        <tr v-for="p of PANELS" :key="p.key">
          <td class="pr-4 py-0.5">{{ p.label }}</td>
          <td class="pr-4"><ui-toggle v-if="p.hud" :modelValue="Boolean(pob.hud[p.hud])" @update:modelValue="v => { if (p.hud) pob.hud[p.hud] = v }" /><span v-else class="text-gray-600 text-sm">—</span></td>
          <td class="pr-4">
            <ui-toggle v-if="p.overlay" :modelValue="placement(p.key).overlay !== false" @update:modelValue="v => setPlacement(p.key, 'overlay', v)" />
            <span v-else class="text-gray-600 text-sm">—</span></td>
          <td>
            <ui-toggle v-if="p.window" :modelValue="placement(p.key).window !== false" @update:modelValue="v => setPlacement(p.key, 'window', v)" />
            <span v-else class="text-gray-600 text-sm">{{ p.key === 'search' ? 'Trade site tab' : '—' }}</span></td>
        </tr>
      </table>
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
          <td class="pr-4 py-0.5">{{ p.label }} <span class="text-gray-500 text-sm">({{ hotkeyOf(p) || 'no hotkey' }})</span></td>
          <td class="pr-4"><ui-toggle :modelValue="Boolean(pob.hud[p.key])" @update:modelValue="v => { pob.hud[p.key] = v }" /></td>
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
      <template v-if="HUD_PANELS.some(p => pob.hud[p.key])">
        <ui-toggle :modelValue="pob.hud.sharedWindow === true" @update:modelValue="v => { pob.hud.sharedWindow = v }" class="mb-1">
          One window for all pinned panels <span class="bg-gray-200 text-gray-900 rounded px-1 text-sm">test</span></ui-toggle>
        <div class="text-gray-500 text-sm mb-2">
          Uses less memory with several panels pinned. Clicks outside a panel go to the game; panels set to let clicks
          through still do. Always see-through. If clicks stop reaching the game or a panel, turn this off.
        </div>
        <ui-toggle v-if="!pob.hud.sharedWindow" v-model="pob.hud.opaque" class="mb-1">Solid background (no see-through window)</ui-toggle>
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
        Open Trade buttons in the Orbhoarder window (Trade site tab)</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        The official trade site in its own tab, signed in separately from your browser (sign in on GGG's own page;
        Orbhoarder never sees your login). Off: Trade buttons open your browser as before.
      </div>
    </div>

  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { configProp } from './utils'
import { defaultHudConfig } from '@/web/Config'
import { PANELS } from '@/web/desktop/panels'
import type { PanelKey, PanelPlacement } from '@ipc/types'
import { usePobConfig, HUD_PANELS, type PanelHotkeyField } from './pob-config'
import type { HudPanel } from '@ipc/types'

export default defineComponent({
  name: 'Panels',
  components: { UiToggle },
  props: configProp(),
  setup (props) {
    const pob = usePobConfig(() => props.config)
    return {
      pob,
      PANELS,
      HUD_PANELS,
      placement (key: PanelKey): PanelPlacement {
        return pob.value.panels?.[key] ?? {}
      },
      setPlacement (key: PanelKey, where: 'overlay' | 'window', on: boolean) {
        pob.value.panels ??= {}
        pob.value.panels[key] = { ...pob.value.panels[key], [where]: on }
      },
      hotkeyOf (p: { key: HudPanel, hotkey: PanelHotkeyField }) {
        return p.hotkey ? pob.value[p.hotkey] : pob.value.panelKeys?.[p.key]
      },
      // applied when the settings window is closed, like every other setting
      resetHudPositions () {
        pob.value.hud.pos = defaultHudConfig().pos
        pob.value.hud.dims = {}
      }
    }
  }
})
</script>
