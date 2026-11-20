<template>
  <div class="max-w-2xl p-2">
    <!-- Deathloom fork: PoE2 mode (phase 1: game switch). Hidden until PoE2 mode is usable;
         still shown if PoE2 is already selected so it can be switched back. -->
    <div class="mb-4" v-if="showGameSwitch">
      <div class="flex-1 mb-1">Game</div>
      <div class="flex gap-x-4">
        <ui-radio v-model="game" value="poe1">Path of Exile 1</ui-radio>
        <ui-radio v-model="game" value="poe2">Path of Exile 2 <span class="bg-gray-200 text-gray-900 rounded px-1 text-sm">early</span></ui-radio>
      </div>
      <div class="text-gray-500 text-sm mt-1" v-if="game === 'poe2'">
        Finds the PoE2 window, Client.txt and config file, and lists PoE2 trade leagues. Price check,
        Path of Building and poe.ninja prices are still PoE1 only. Restart Orbhoarder after switching.
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">{{ t(':language') }}</div>
      <select v-model="language" class="p-1 rounded bg-gray-700 w-24">
        <option value="en">English</option>
        <option value="ru">Русский</option>
        <option value="cmn-Hant">正體中文</option>
        <option value="ko">한국어</option>
      </select>
    </div>
    <div class="mb-2" v-if="language === 'cmn-Hant'">
      <div class="flex-1 mb-1">{{ t('realm') }}</div>
      <div class="flex gap-x-4">
        <ui-radio v-model="realm" value="pc-ggg">{{ t('realm_intl') }}</ui-radio>
        <ui-radio v-model="realm" value="pc-garena">{{ t('Hotcool') }}</ui-radio>
      </div>
    </div>
    <ui-checkbox class="mb-4" v-if="language !== 'en' && realm === 'pc-ggg'"
      v-model="useIntlSite" :disabled="forcedIntlSite"
      :class="{ 'text-gray-500': forcedIntlSite }">{{ t(':use_intl_site') }} <span class="bg-gray-200 text-gray-900 rounded px-1">www.pathofexile.com</span></ui-checkbox>
    <div class="mb-4 mt-4">
      <div class="flex-1 mb-1">{{ t(':font_size') }}</div>
      <div class="flex gap-1">
        <input v-model.number="fontSize" class="rounded bg-gray-900 px-1 block w-16 font-poe text-center" />
        <span>px</span>
      </div>
    </div>
    <ui-checkbox class="mb-4"
      v-model="restoreClipboard">{{ t(':restore_clipboard') }}</ui-checkbox>
    <div class="mb-2">
      <div class="flex-1 mb-1">{{ t(':poe_log_file') }}</div>
      <input v-model.trim="clientLog"
        class="rounded bg-gray-900 px-1 block w-full font-sans" placeholder="...?/Grinding Gear Games/Path of Exile/logs/Client.txt">
    </div>
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t(':poe_cfg_file') }}</div>
      <input v-model.trim="gameConfig"
        class="rounded bg-gray-900 px-1 block w-full font-sans" placeholder="...?/My Games/Path of Exile/production_Config.ini">
    </div>
    <hr class="mb-4 mx-8 border-gray-700">
    <div class="mb-2">
      <div class="mb-1">{{ t(':overlay_bg') }}</div>
      <div class="flex gap-4 items-baseline">
        <input v-model="overlayBackground" class="rounded bg-gray-900 px-1 block w-48 font-poe text-center" />
        <ui-radio v-model="overlayBackground" value="rgba(255, 255, 255, 0)">{{ t(':overlay_bg_none') }}</ui-radio>
      </div>
    </div>
    <ui-checkbox class="mb-2" v-if="overlayBackground !== 'rgba(255, 255, 255, 0)'"
      v-model="overlayBackgroundClose">{{ t(':overlay_bg_focus_game') }}</ui-checkbox>
    <ui-checkbox class="mb-4"
      v-model="showAttachNotification">{{ t(':show_overlay_ready') }}</ui-checkbox>
    <div class="mb-4">
      <div class="flex-1 mb-1">{{ t(':window_title') }} <span class="bg-gray-200 text-gray-900 rounded px-1">{{ t('Restart required') }}</span></div>
      <input v-model="windowTitle" class="rounded bg-gray-900 px-1 block w-full mb-1 font-poe" />
    </div>
    <hr class="mb-4 mx-8 border-gray-700">
    <!-- Deathloom fork: startup, windows, updates and problem reports -->
    <div class="mb-4">
      <ui-toggle :modelValue="pob.startWithWindows !== false" @update:modelValue="pob.startWithWindows = $event">Start Orbhoarder with Windows</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Starts in the tray when you sign in to Windows, so hotkeys, the HUD and updates are ready before the game.
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.desktopAtStart === true" @update:modelValue="pob.desktopAtStart = $event">Open the Orbhoarder window when the game starts</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        A normal window with all panels (build, guide, trades, market) for a second screen. Also from the tray:
        double-click the icon or "Open Orbhoarder window". It remembers its screen, position and size.
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.window2?.enabled === true" @update:modelValue="pob.window2 = { ...pob.window2, enabled: $event }">Second Orbhoarder window (for a third screen)</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Its own tabs, All-tab layout and look (Settings → Appearance in that window), and its own screen and position.
        Open it from the tray: "Open second Orbhoarder window". Trade pages, panel hotkeys and the Lab button still go to the main window.
      </div>
      <ui-toggle v-if="pob.window2?.enabled" class="mt-2" :modelValue="pob.window2.atStart === true" @update:modelValue="pob.window2 = { ...pob.window2, atStart: $event }">Open it when the game starts too</ui-toggle>
    </div>
    <div class="mb-4">
      <div class="mb-1">Updates</div>
      <select :value="pob.updateChannel ?? (/-beta\.\d+$/.test(appVersion) ? 'testing' : 'stable')" class="rounded bg-gray-900 px-1"
        @change="pob.updateChannel = (($event.target as HTMLSelectElement).value as 'stable' | 'testing')">
        <option value="stable">Stable releases (everyone)</option>
        <option value="testing">Testing: also test releases (to try changes before friends get them)</option>
      </select>
      <div class="text-gray-500 text-sm mt-1">
        Testing installs test versions (like 1.0.89-beta.1) as soon as they're out, and the stable release when it comes.
        Switching back to Stable keeps the version you have until a newer stable release.
      </div>
    </div>

    <div class="mb-4">
      <ui-toggle :modelValue="pob.patchNotesAlert !== false" @update:modelValue="pob.patchNotesAlert = $event">Tell me when new patch notes are out</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Every 30 minutes while Orbhoarder runs, it reads GGG's public Patch Notes forum page (PC). New notes show a
        Windows notification (click to read them) and a dot on <b>Patch notes</b> in Cheat sheets and Settings. PoE1 only.
      </div>
    </div>
    <div class="mb-4">
      <ui-toggle :modelValue="pob.errorReports !== false" @update:modelValue="pob.errorReports = $event">Send problem reports automatically</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        When Orbhoarder or its Path of Building hits an error, it opens an issue in the group's private
        POE-Builds/poe-builds repo with your GitHub sign-in (build sharing): version, error and the last log lines,
        without your Windows user folder. Not sent when you're not signed in. Tray → Report a problem… for anything else.
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useI18nNs } from '@/web/i18n'
import UiRadio from '@/web/ui/UiRadio.vue'
import UiCheckbox from '@/web/ui/UiCheckbox.vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { Host } from '@/web/background/IPC'
import { usePobConfig } from './pob-config'
import { configModelValue, configProp } from './utils'
import { AppConfig } from '@/web/Config'
import { windowTitleOnSwitch, type Game } from '@ipc/game'

// Deathloom fork: PoE2 mode is deferred until the PoE1 app is done. Set true to show the switch.
const GAME_SWITCH_ENABLED = false

export default defineComponent({
  name: 'settings.general',
  components: { UiRadio, UiCheckbox, UiToggle },
  props: configProp(),
  setup (props) {
    const { t } = useI18nNs('settings')

    return {
      t,
      pob: usePobConfig(() => props.config),
      appVersion: Host.version,
      fontSize: configModelValue(() => props.config, 'fontSize'),
      overlayBackgroundClose: configModelValue(() => props.config, 'overlayBackgroundClose'),
      overlayBackground: configModelValue(() => props.config, 'overlayBackground'),
      clientLog: configModelValue(() => props.config, 'clientLog'),
      gameConfig: configModelValue(() => props.config, 'gameConfig'),
      language: computed<typeof props.config.language>({
        get () { return props.config.language },
        set (value) {
          props.config.language = value
          AppConfig().language = value
          if (value !== 'cmn-Hant') {
            props.config.realm = 'pc-ggg'
          }
          props.config.useIntlSite = (props.config.realm === 'pc-ggg' && value === 'cmn-Hant')
        }
      }),
      realm: computed<typeof props.config.realm>({
        get () { return props.config.realm },
        set (value) {
          props.config.realm = value
          props.config.useIntlSite = (value === 'pc-ggg' && props.config.language === 'cmn-Hant')
        }
      }),
      useIntlSite: configModelValue(() => props.config, 'useIntlSite'),
      forcedIntlSite: computed(() => props.config.realm === 'pc-ggg' && props.config.language === 'cmn-Hant'),
      restoreClipboard: configModelValue(() => props.config, 'restoreClipboard'),
      showAttachNotification: configModelValue(() => props.config, 'showAttachNotification'),
      windowTitle: configModelValue(() => props.config, 'windowTitle'),
      showGameSwitch: computed(() => GAME_SWITCH_ENABLED || props.config.game !== 'poe1'),
      game: computed<Game>({
        get () { return props.config.game },
        set (value) {
          const from = props.config.game
          if (value === from) return
          // each game keeps its own league; a custom window title is kept
          const byGame = { ...props.config.leagueIdByGame }
          if (props.config.leagueId) byGame[from] = props.config.leagueId
          props.config.leagueIdByGame = byGame
          props.config.leagueId = byGame[value]
          props.config.windowTitle = windowTitleOnSwitch(value, props.config.windowTitle)
          props.config.game = value
        }
      })
    }
  }
})
</script>
