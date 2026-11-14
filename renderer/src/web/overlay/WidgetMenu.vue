<template>
  <widget :config="config" :hideable="false" :removable="false" move-handles="corners" v-slot="{ isEditing }">
    <div class="widget-default-style">
      <div class="p-1 flex gap-1 items-center text-base">
        <template v-for="widget in widgets" :key="widget.wmId">
          <button @click="toggle(widget)" :title="widget.hint"
            :class="widget.wmWants === 'show' ? 'border-gray-500' : 'border-gray-800'"
            class="bg-gray-800 rounded text-gray-100 p-2 leading-none whitespace-nowrap border"
          >
            <i v-if="widget.icon" class="fas align-bottom" :class="widget.icon" />
            <template v-if="widget.title">{{ widget.title }}</template>
          </button>
        </template>
        <ui-popover>
          <template #target>
            <button class="rounded text-gray-600 px-2 py-1 leading-none" title="Add a widget"><i class="fas fa-ellipsis-h"></i></button>
          </template>
          <template #content>
            <div class="flex flex-col justify-center text-base">
              <div class="text-gray-600 text-sm px-1 select-none whitespace-nowrap">{{ t(':add') }}</div>
              <button v-for="spec in instantiableWidgets" :key="spec.type"
                class="text-left hover:bg-gray-400 rounded px-1 whitespace-nowrap"
                @click="createOfType(spec.type)">{{ t(spec.trNameKey ?? spec.type) }}</button>
            </div>
          </template>
        </ui-popover>
        <!-- Deathloom fork: setup guide + how-to -->
        <button class="rounded px-2 py-1 leading-none text-gray-600 hover:text-gray-100"
          title="Setup guide (run it again)" @click="openSetup"><i class="fas fa-magic"></i></button>
        <button class="rounded px-2 py-1 leading-none" :class="showHelp ? 'text-gray-100' : 'text-gray-600'"
          title="How to use the overlay" @click="showHelp = !showHelp"><i class="fas fa-question-circle"></i></button>
      </div>
      <div v-if="showHelp" class="px-2 pb-2 text-sm text-gray-300 leading-snug" style="max-width: 34rem;">
        <div class="text-gray-100 mb-1">How to use it</div>
        <ul class="list-disc pl-4 space-y-0.5">
          <li><b>{{ help.overlayKey }}</b>: open / close the overlay (this bar). Esc closes it too.</li>
          <li><b>{{ help.priceKey }}</b> over an item in game: price check, with what it does to your PoB build.</li>
          <li><b>{{ help.gearKey }}</b> build gear, <b>{{ help.guideKey }}</b> campaign guide, <b>{{ help.tradesKey }}</b> trade companion: show / hide.</li>
          <li><b>{{ help.openPobKey }}</b> opens Path of Building. In the build panel, <i class="fas fa-cloud" /> shares builds (GitHub sign-in, Pull / Push) and <i class="fas fa-file-import" /> imports a PoB code or link.</li>
          <li>Pinned panels (Settings <i class="fas fa-cog"></i> → Path of Building → Show while playing) stay on screen while you play.
            Drag them by the top bar or any empty spot.</li>
          <li>Build gear: <i class="far fa-copy"></i> copies the name for the in-game market (press <b>/</b>, then Ctrl+V),
            <b>Trade</b> opens an exact search on the trade site, <i class="fas fa-search-dollar"></i> opens the price check.
            <i class="fas fa-exchange-alt"></i> picks the build and loadout.</li>
          <li>Trade companion: buttons copy the chat command (or send it, see settings). Ledger tab = your sales and buys.</li>
          <li><i class="fas fa-search-dollar"></i> Market search: find an item by name, then <b>Whisper</b> (GGG's buy message) or <b>Hideout</b> the seller, one click = one chat message.</li>
          <li>Trade buttons open GGG's trade site in the Loot Goblin window's <b>Trade site</b> tab (or your browser, see settings).</li>
          <li>Which panels show in game, in the overlay or in the Loot Goblin window: Settings → Path of Building → Where panels show.</li>
          <li>Campaign guide: moves on by itself when you reach the next zone on the route; arrows to fix it by hand.</li>
          <li>The buttons on this bar open or close a panel; hover one to see its name. <i class="fas fa-magic"></i> runs the setup guide again.</li>
        </ul>
        <button class="mt-2 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="openFullHelp">
          <i class="fas fa-book mr-1"></i>Full help, FAQ and where to get a build (Loot Goblin window)</button>
      </div>
      <div v-if="isEditing" class="text-gray-100 px-2 pb-1 whitespace-nowrap">
        <ui-toggle v-model="config.alwaysShow">{{ t(':always_show') }}</ui-toggle>
      </div>
      <div v-else class="px-1 pb-1">
        <textarea class="px-2 py-1.5 bg-gray-700 rounded resize-none block"
          rows="1" spellcheck="false"
          :placeholder="t(':price_check')" @input="handleItemPaste"></textarea>
      </div>
    </div>
  </widget>
</template>

<script lang="ts">
import { defineComponent, PropType, computed, inject, ref } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import UiPopover from '@/web/ui/Popover.vue'
import { Widget as IWidget, WidgetManager, WidgetMenu, WidgetSpec } from './interfaces'
import { registry } from './widget-registry'
import { Host } from '@/web/background/IPC'
import Widget from './Widget.vue'
import { useI18nNs } from '@/web/i18n'
import { AppConfig } from '@/web/Config'
import type { PriceCheckWidget } from './widgets'

// Deathloom fork: names for the icon-only buttons (shown on hover)
function hintFor (type: string): string | undefined {
  const pob = AppConfig().pob
  const key = (k: string | null | undefined) => k ? ` (${k})` : ''
  switch (type) {
    case 'settings': return 'Settings'
    case 'item-search': return 'Item search'
    case 'pob-gear': return 'Build gear' + key(pob?.gearPanelKey)
    case 'campaign-guide': return 'Campaign guide' + key(pob?.guideKey)
    case 'trade-companion': return 'Trade companion' + key(pob?.tradesKey)
    case 'market-history': return 'Market history (price trends of starred items)'
    case 'market-search': return 'Market search (find an item and whisper the seller)'
    case 'stash-search': return 'Stash search'
    case 'image-strip': return 'Image strip'
    case 'delve-grid': return 'Delve grid'
    case 'timer': return 'Stopwatch'
    default: return undefined
  }
}

export default defineComponent({
  widget: {
    type: 'menu',
    instances: 'single',
    initInstance: (): WidgetMenu => {
      return {
        wmId: 0,
        wmType: 'menu',
        wmTitle: '',
        wmWants: 'show',
        wmZorder: 1,
        wmFlags: ['invisible-on-blur', 'menu::skip'],
        anchor: {
          pos: 'tl',
          x: 5,
          y: 5
        },
        alwaysShow: false
      }
    }
  } satisfies WidgetSpec,
  components: { Widget, UiToggle, UiPopover },
  props: {
    config: {
      type: Object as PropType<WidgetMenu>,
      required: true
    }
  },
  setup (props) {
    const wm = inject<WidgetManager>('wm')!

    const widgets = computed(() => {
      return wm.widgets.value.filter(widget =>
        !widget.wmFlags.includes('menu::skip') &&
        (props.config.alwaysShow || (widget.wmWants === 'hide'))
      ).map((widget) => {
        const regexMatch = widget.wmTitle
          .match(/^(?:\{icon=(?<icon>[^}]+)\}\s*)?(?<title>.*)$/)
        return {
          wmId: widget.wmId,
          wmWants: widget.wmWants,
          hint: hintFor(widget.wmType) ?? (regexMatch?.groups!.title || undefined),
          title: regexMatch?.groups!.title ||
            ((!regexMatch?.groups!.icon) ? `#${widget.wmId}` : undefined),
          icon: regexMatch?.groups!.icon
        }
      })
    })

    const { t } = useI18nNs('widget_menu')

    const showHelp = ref(false)
    function openFullHelp () {
      Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-window-view', view: 'help' } })
    }
    const help = computed(() => {
      const pob = AppConfig().pob
      const pc = AppConfig<PriceCheckWidget>('price-check')
      return {
        overlayKey: AppConfig().overlayKey,
        priceKey: pc?.hotkey ? `${pc.hotkeyHold} + ${pc.hotkey}` : 'the price check hotkey',
        gearKey: pob?.gearPanelKey || 'no hotkey',
        guideKey: pob?.guideKey || 'no hotkey',
        tradesKey: pob?.tradesKey || 'no hotkey',
        openPobKey: pob?.openPobKey || 'No hotkey'
      }
    })

    return {
      t,
      showHelp,
      openFullHelp,
      help,
      widgets,
      instantiableWidgets: computed(() => {
        return registry.widgets
          .filter(({ widget }) => widget.instances === 'multi')
          .map(({ widget }) => widget)
      }),
      openSetup () {
        const w = wm.widgets.value.find(w => w.wmType === 'setup-guide')
        if (w) wm.show(w.wmId)
      },
      createOfType (type: string) {
        wm.create(type)
      },
      toggle (widget: Pick<IWidget, 'wmId' | 'wmWants'>) {
        if (widget.wmWants === 'hide') {
          wm.show(widget.wmId)
        } else {
          wm.hide(widget.wmId)
        }
      },
      handleItemPaste (e: Event) {
        const target = e.target as HTMLInputElement
        const inputRect = target.getBoundingClientRect()
        Host.selfDispatch({
          name: 'MAIN->CLIENT::item-text',
          payload: {
            clipboard: target.value,
            position: {
              x: window.screenX + inputRect.x + inputRect.width / 2,
              y: window.screenY + inputRect.y + inputRect.height / 2
            },
            focusOverlay: true,
            target: 'price-check'
          }
        })
        target.value = ''
      }
    }
  }
})
</script>
