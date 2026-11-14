<template>
  <!-- Deathloom fork: themes and look settings (src/web/appearance.ts) -->
  <div class="max-w-md p-2">
    <div class="text-gray-500 text-sm mb-4">
      Changes show straight away in this window; Save applies them to the overlay, the in-game panels and the Loot Goblin window.
    </div>
    <div v-if="isWindow2" class="mb-4 p-2 rounded bg-gray-800">
      <ui-toggle :modelValue="ownLook" @update:modelValue="setOwnLook">This window has its own look</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">{{ ownLook ? 'Changes below only apply to this second window.' : 'Off: this window looks like the main Loot Goblin window.' }}</div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Theme</div>
      <div class="grid grid-cols-1 gap-1">
        <button v-for="(th, id) in THEMES" :key="id" type="button"
          class="flex items-center gap-2 px-2 py-1 rounded text-left"
          :class="a.theme === id ? 'bg-gray-600 text-gray-100' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
          @click="a.theme = id">
          <span class="flex shrink-0 rounded overflow-hidden border border-gray-600">
            <span v-for="c in [th.gray[8], th.gray[6], th.gray[4], th.gray[1]]" :key="c" class="w-3 h-4" :style="{ background: c }" />
            <span class="w-3 h-4" :style="{ background: th.accent }" />
          </span>
          <span>{{ th.name }}</span>
        </button>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-1">Accent colour</div>
      <div class="flex items-center gap-2">
        <ui-toggle :modelValue="a.accent !== ''" @update:modelValue="a.accent = $event ? THEMES[a.theme].accent : ''">Own colour</ui-toggle>
        <input v-if="a.accent !== ''" type="color" v-model="a.accent" class="w-10 h-6 bg-transparent cursor-pointer" />
        <span v-else class="text-gray-500 text-sm">theme's accent</span>
      </div>
      <div class="text-gray-500 text-sm mt-1">Used for highlighted buttons, focused fields and links.</div>
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

    <div class="mb-2 pt-2 border-t border-gray-700">Loot Goblin window</div>
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
import { THEMES, FONTS, applyAppearance, defaultAppearance } from '@/web/appearance'
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
    watch(a, (v) => { applyAppearance(v, SURFACE) }, { deep: true, immediate: true })
    onUnmounted(() => { applyAppearance(surfaceAppearance(AppConfig()), SURFACE) })

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
