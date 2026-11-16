<template>
  <!-- Deathloom fork: themes and look settings (src/web/appearance.ts) -->
  <div class="max-w-2xl p-2">
    <div class="text-gray-500 text-sm mb-4">
      Changes show straight away in this window; Save applies them to the overlay, the in-game panels and the Orbhoarder window.
    </div>
    <div v-if="isWindow2" class="mb-4 p-2 rounded bg-gray-800">
      <ui-toggle :modelValue="ownLook" @update:modelValue="setOwnLook">This window has its own look</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">{{ ownLook ? 'Changes below only apply to this second window.' : 'Off: this window looks like the main Orbhoarder window.' }}</div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Theme</div>
      <div class="flex flex-wrap gap-x-4 mb-1">
        <ui-radio v-model="a.themeMode" value="fixed">Pick one</ui-radio>
        <ui-radio v-model="a.themeMode" value="seasonal">Seasonal (changes by itself)</ui-radio>
        <ui-radio v-model="a.themeMode" value="league">Follow the current league</ui-radio>
      </div>
      <div v-if="a.themeMode === 'seasonal'" class="mb-2 p-2 rounded bg-gray-800">
        <div class="flex flex-wrap gap-x-4">
          <ui-radio v-model="a.hemisphere" value="south">Southern hemisphere (summer Dec–Feb)</ui-radio>
          <ui-radio v-model="a.hemisphere" value="north">Northern hemisphere (summer Jun–Aug)</ui-radio>
        </div>
        <ui-toggle v-model="a.holidays" class="mt-1">Holidays for a few days (Valentine's, Easter, Halloween, festive season, New Year)</ui-toggle>
      </div>
      <div v-if="a.themeMode === 'league'" class="text-gray-500 text-sm mb-2">
        Uses the league picked in Settings → Price check. Leagues without a theme yet use the theme you pick below.
      </div>
      <div class="text-sm mb-2">
        <span class="text-gray-500">Now:</span> {{ active.why }}
        <template v-if="active.next">
          <br><span class="text-gray-500">Changes to</span> {{ THEMES[active.next.id].name }} <span class="text-gray-500">on</span> {{ fmtDate(active.next.date) }}
        </template>
      </div>
      <div v-for="g in groups" :key="g.id" class="mb-2">
        <div class="text-gray-500 text-sm">{{ g.name }}</div>
        <div class="grid grid-cols-1 gap-1">
          <button v-for="id in g.themes" :key="id" type="button"
            class="flex items-center gap-2 px-2 py-1 rounded text-left"
            :class="[a.theme === id ? 'bg-accent/20 text-gray-100 ring-1 ring-accent/60' : 'bg-gray-800 text-gray-400 hover:bg-gray-700', active.id === id && a.theme !== id ? 'ring-1 ring-accent' : '']"
            @click="pick(id)">
            <span class="flex shrink-0 rounded overflow-hidden border border-gray-600">
              <span v-for="c in [THEMES[id].gray[8], THEMES[id].gray[6], THEMES[id].gray[4], THEMES[id].gray[1]]" :key="c" class="w-3 h-4" :style="{ background: c }" />
              <span class="w-3 h-4" :style="{ background: THEMES[id].accent }" />
            </span>
            <span>{{ THEMES[id].name }}</span>
            <span v-if="active.id === id" class="ml-auto text-xs text-accent">active</span>
          </button>
        </div>
      </div>
      <div class="text-gray-500 text-sm">{{ a.themeMode === 'seasonal' ? 'Picking a theme here switches to Pick one.' : '' }}
        Some fun themes bring their own font and corners unless you changed those below.</div>
      <ui-toggle v-model="a.decorations" class="mt-1">Theme background decorations in the Orbhoarder window</ui-toggle>
      <div v-if="a.decorations" class="mt-1">
        <div>Decoration strength <span class="text-gray-500">{{ a.decorStrength }}%</span></div>
        <input type="range" min="50" max="300" step="10" v-model.number="a.decorStrength" class="w-full" />
      </div>
      <ui-toggle v-model="a.glass" class="mt-1">Glass panels in the Orbhoarder window (see-through and blurred, so the theme shows)</ui-toggle>
      <div v-if="THEMES[active.id].flat" class="text-gray-500 text-sm">{{ THEMES[active.id].name }} is flat: no glass panels.</div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Animations</div>
      <div class="flex flex-wrap gap-x-4">
        <ui-radio v-model="a.motion" value="full">Full</ui-radio>
        <ui-radio v-model="a.motion" value="subtle">Subtle</ui-radio>
        <ui-radio v-model="a.motion" value="off">Off</ui-radio>
      </div>
      <div class="text-gray-500 text-sm mt-1">{{ a.motion === 'off' ? 'Everything appears instantly.' : a.motion === 'subtle' ? 'Smooth hover and click effects only.' : 'Panels and tabs ease in, new rows slide in, buttons react, and theme backgrounds drift slowly (snow falls, leaves blow, sparkles rise).' }}
        Windows' "Show animations" setting off turns them off too.</div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Accent colour</div>
      <div class="flex items-center gap-2">
        <ui-toggle :modelValue="a.accent !== ''" @update:modelValue="a.accent = $event ? THEMES[active.id].accent : ''">Own colour</ui-toggle>
        <input v-if="a.accent !== ''" type="color" v-model="a.accent" class="w-10 h-6 bg-transparent cursor-pointer" />
        <span v-else class="text-gray-500 text-sm">theme's accent</span>
      </div>
      <div class="text-gray-500 text-sm mt-1">Used for highlighted buttons, focused fields and links.</div>
    </div>

    <div class="mb-4">
      <ui-toggle v-model="a.readableText">Easier-to-read small print</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">Small text (hints, notes, counts) a bit bigger and brighter, in a plain font even when the theme uses Fontin. Turn off for the old look.</div>
    </div>

    <div class="mb-4 flex gap-4">
      <div>
        <div class="mb-1">Font</div>
        <select v-model="a.font" class="p-1 rounded bg-gray-700">
          <option v-for="(f, id) in FONTS" :key="id" :value="id">{{ f.name }}</option>
        </select>
      </div>
      <div>
        <div class="mb-1">Font size</div>
        <div class="flex gap-1 items-center">
          <input v-model.number="fontSize" class="rounded bg-gray-900 px-1 block w-16 font-poe text-center" />
          <span>px</span>
        </div>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Corners</div>
      <div class="flex gap-x-4">
        <ui-radio v-model="a.rounding" :value="0">Square</ui-radio>
        <ui-radio v-model="a.rounding" :value="1">Normal</ui-radio>
        <ui-radio v-model="a.rounding" :value="2">Round</ui-radio>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Overlay panel opacity <span class="text-gray-500">{{ a.overlayOpacity }}%</span></div>
      <input type="range" min="40" max="100" step="5" v-model.number="a.overlayOpacity" class="w-full" />
      <div class="text-gray-500 text-sm">Lower lets the game show through the overlay's panels.</div>
    </div>

    <div class="mb-2 pt-2 border-t border-gray-700">Orbhoarder window</div>
    <div class="mb-2">
      <div class="flex gap-x-4">
        <ui-radio v-model="a.windowBg" value="theme">Theme</ui-radio>
        <ui-radio v-model="a.windowBg" value="color">Colour</ui-radio>
        <ui-radio v-model="a.windowBg" value="image">Picture</ui-radio>
      </div>
    </div>
    <div v-if="a.windowBg === 'color'" class="mb-2">
      <input type="color" v-model="a.windowBgColor" class="w-10 h-6 bg-transparent cursor-pointer" />
    </div>
    <div v-if="a.windowBg === 'image'" class="mb-2">
      <div class="flex items-center gap-2 mb-2">
        <button type="button" class="btn" @click="pickImage">Choose picture…</button>
        <span class="text-gray-500 text-sm truncate">{{ a.windowBgImage ? 'Picture set' : 'No picture yet' }}</span>
        <input ref="fileEl" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onFile" />
      </div>
      <div v-if="error" class="text-red-400 text-sm mb-2">{{ error }}</div>
      <div class="mb-1">Darken picture <span class="text-gray-500">{{ a.windowBgDim }}%</span></div>
      <input type="range" min="0" max="90" step="5" v-model.number="a.windowBgDim" class="w-full" />
    </div>
    <div class="mb-4">
      <div class="mb-1">Window panel opacity <span class="text-gray-500">{{ a.windowOpacity }}%</span></div>
      <input type="range" min="40" max="100" step="5" v-model.number="a.windowOpacity" class="w-full" />
      <div class="text-gray-500 text-sm">Lower lets the background show through the panels.</div>
    </div>

    <button type="button" class="btn" @click="reset">Reset to defaults</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, watch, onUnmounted, shallowRef, type PropType } from 'vue'
import UiRadio from '@/web/ui/UiRadio.vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { AppConfig, surfaceAppearance, type Config } from '@/web/Config'
import { Host } from '@/web/background/IPC'
import { THEMES, THEME_GROUPS, FONTS, applyAppearance, defaultAppearance, resolveTheme, themeGroup, type ThemeId } from '@/web/appearance'
import { IS_HUD, IS_DESKTOP, IS_DESKTOP2 } from '@/web/hud/is-hud'
import { configModelValue } from './utils'

const MAX_IMAGE_BYTES = 15_000_000
const SURFACE = IS_HUD ? 'hud' : IS_DESKTOP ? 'desktop' : 'overlay'

export default defineComponent({
  name: 'Appearance',
  components: { UiRadio, UiToggle },
  props: {
    config: {
      type: Object as PropType<Config>,
      required: true
    }
  },
  setup (props) {
    // settings edits a copy of the config: preview it, put the saved look back on close
    // second window with its own look: edit that copy instead
    const ownLook = computed(() => IS_DESKTOP2 && props.config.window2Appearance != null)
    const a = computed(() => surfaceAppearance(props.config))
    watch(a, (v) => { applyAppearance(v, SURFACE, props.config.leagueId) }, { deep: true, immediate: true })
    onUnmounted(() => { applyAppearance(surfaceAppearance(AppConfig()), SURFACE, AppConfig().leagueId) })
    const active = computed(() => resolveTheme(a.value, props.config.leagueId))
    const groups = THEME_GROUPS.map(g => ({ ...g, themes: (Object.keys(THEMES) as ThemeId[]).filter(id => themeGroup(id) === g.id) }))

    const fileEl = shallowRef<HTMLInputElement | null>(null)
    const error = shallowRef('')

    return {
      a,
      isWindow2: IS_DESKTOP2,
      ownLook,
      setOwnLook (on: boolean) {
        if (on) props.config.window2Appearance = JSON.parse(JSON.stringify(props.config.appearance))
        else delete props.config.window2Appearance
      },
      THEMES,
      FONTS,
      active,
      groups,
      fmtDate: (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      pick (id: ThemeId) {
        a.value.theme = id
        if (a.value.themeMode === 'seasonal') a.value.themeMode = 'fixed'
      },
      error,
      fileEl,
      fontSize: configModelValue(() => props.config, 'fontSize'),
      pickImage () { fileEl.value?.click() },
      async onFile (e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        error.value = ''
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
          error.value = 'Use a PNG, JPG, WebP or GIF picture.'
          return
        }
        if (file.size > MAX_IMAGE_BYTES) {
          error.value = 'That picture is over 15 MB.'
          return
        }
        try {
          const ext = file.type === 'image/jpeg' ? '.jpg' : '.' + file.type.split('/')[1]
          const name = await Host.importFile(new File([file], 'background' + ext, { type: file.type }))
          a.value.windowBgImage = name
        } catch {
          error.value = "Couldn't save the picture."
        }
      },
      reset () {
        if (ownLook.value) {
          props.config.window2Appearance = defaultAppearance()
          return
        }
        props.config.appearance = defaultAppearance()
        props.config.fontSize = 16
      }
    }
  }
})
</script>
