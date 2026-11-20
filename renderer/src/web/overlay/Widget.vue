<template>
  <div @mousedown="handleMouseDown">
    <div :class="[$style.widget, { 'opacity-75': isMoving }]" :style="widgetPosition">
      <!-- Deathloom fork: drag bar on top (same as the pinned panels); offset kept, no jump -->
      <div v-if="grip" class="flex flex-col min-h-0">
        <div :class="$style.grip" title="Drag to move" @mousedown.left.prevent="startGripDrag">
          <i class="fas fa-grip-lines" /><span v-if="gripLabel" class="truncate">{{ gripLabel }}</span>
        </div>
        <slot :isEditing="isEditing" :isMoving="isMoving" />
      </div>
      <slot v-else :isEditing="isEditing" :isMoving="isMoving" />
      <div class="absolute px-1" :style="actionsPosition" style="background: rgba(0,0,0,0.01);">
        <div :class="$style.actionsPanel">
          <button v-if="hideable" @click="hide"
            :class="$style.action">{{ t('widget.hide') }}</button>
          <button v-if="!readonly" @click="toggleEdit"
            :class="[$style.action, { [$style.active]: isEditing }]">{{ t('widget.edit') }}</button>
          <button v-if="moveHandles !== 'none'" @click="toggleMove"
            :class="[$style.action, { [$style.active]: isMoving }]">{{ t('widget.move') }}</button>
          <button v-if="removable" @mousedown="startRemoveTimer" @mouseup="cancelRemoveTimer" @mouseleave="cancelRemoveTimer"
            :class="[$style.action, $style.removable, { [$style.removing]: isRemoving }]">{{ t('widget.delete') }}</button>
        </div>
      </div>
      <div v-if="isMoving">
        <div v-if="isHandleShown('tl')" :class="$style.mover" @mousedown="startMove('tl', $event)" style="left: -0.5rem; top: -0.5rem;"></div>
        <div v-if="isHandleShown('tc')" :class="$style.mover" @mousedown="startMove('tc', $event)" style="left: calc(50%  - 0.5rem); top: -0.5rem;"></div>
        <div v-if="isHandleShown('tr')" :class="$style.mover" @mousedown="startMove('tr', $event)" style="left: calc(100% - 0.5rem); top: -0.5rem;"></div>
        <div v-if="isHandleShown('cr')" :class="$style.mover" @mousedown="startMove('cr', $event)" style="left: calc(100% - 0.5rem); top: calc(50% - 0.5rem);"></div>
        <div v-if="isHandleShown('br')" :class="$style.mover" @mousedown="startMove('br', $event)" style="left: calc(100% - 0.5rem); top: calc(100% - 0.5rem);"></div>
        <div v-if="isHandleShown('bc')" :class="$style.mover" @mousedown="startMove('bc', $event)" style="left: calc(50%  - 0.5rem); top: calc(100% - 0.5rem);"></div>
        <div v-if="isHandleShown('bl')" :class="$style.mover" @mousedown="startMove('bl', $event)" style="left: -0.5rem; top: calc(100% - 0.5rem);"></div>
        <div v-if="isHandleShown('cl')" :class="$style.mover" @mousedown="startMove('cl', $event)" style="left: -0.5rem; top: calc(50%  - 0.5rem);"></div>
        <div v-if="isHandleShown('cc')" :class="$style.mover" @mousedown="startMove('cc', $event)" style="left: calc(50%  - 0.5rem); top: calc(50%  - 0.5rem);"></div>
      </div>
    </div>
    <div v-if="isMoving" :class="[$style.mover, $style.active]" :style="moverPosition" @mousedown="startMove(config.anchor.pos, $event)"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, computed, inject, ref } from 'vue'
import { Widget, Anchor, WidgetManager } from './interfaces'
import { useI18n } from 'vue-i18n'

function useRemovable (remove: () => void) {
  const isRemoving = ref(false)
  let tmid: ReturnType<typeof setTimeout> | null = null

  function startRemoveTimer () {
    isRemoving.value = true
    tmid = setTimeout(remove, 1000)
  }
  function cancelRemoveTimer () {
    isRemoving.value = false
    if (tmid !== null) {
      clearTimeout(tmid)
      tmid = null
    }
  }

  return { startRemoveTimer, cancelRemoveTimer, isRemoving }
}

export default defineComponent({
  props: {
    config: {
      type: Object as PropType<Widget & { anchor: Anchor }>,
      required: true
    },
    moveHandles: {
      type: [String, Array] as PropType<string | string[]>,
      default: undefined
    },
    readonly: {
      type: Boolean,
      default: false
    },
    removable: {
      type: Boolean,
      default: true
    },
    hideable: {
      type: Boolean,
      default: true
    },
    inlineEdit: {
      type: Boolean,
      default: true
    },
    grip: {
      type: Boolean,
      default: false
    },
    gripLabel: {
      type: String,
      default: ''
    }
  },
  setup (props) {
    const wm = inject<WidgetManager>('wm')!

    const moverPosition = computed(() => {
      const { anchor, wmZorder } = props.config
      return {
        'top': `max(0%, min(calc(${anchor.y}% - (1rem/2)), calc(100% - 1rem)))`,
        'left': `max(0%, min(calc(${anchor.x}% - (1rem/2)), calc(100% - 1rem)))`,
        'z-index': (typeof wmZorder === 'number') ? wmZorder : undefined
      }
    })

    const widgetPosition = computed(() => {
      const { anchor, wmZorder } = props.config

      // <top, center, bottom><left, center, right>
      let translate: string | undefined
      let max = { w: 100, h: 100 }
      if (anchor.pos === 'tl') {
        translate = undefined
        max = { w: 100 - anchor.x, h: 100 - anchor.y }
      } else if (anchor.pos === 'tc') {
        translate = 'translate(-50%, 0%)'
        max = { w: 2 * Math.min(100 - anchor.x, anchor.x), h: 100 - anchor.y }
      } else if (anchor.pos === 'tr') {
        translate = 'translate(-100%, 0%)'
        max = { w: anchor.x, h: 100 - anchor.y }
      } else if (anchor.pos === 'cr') {
        translate = 'translate(-100%, -50%)'
        max = { w: anchor.x, h: 2 * Math.min(100 - anchor.y, anchor.y) }
      } else if (anchor.pos === 'br') {
        translate = 'translate(-100%, -100%)'
        max = { w: anchor.x, h: anchor.y }
      } else if (anchor.pos === 'bc') {
        translate = 'translate(-50%, -100%)'
        max = { w: 2 * Math.min(100 - anchor.x, anchor.x), h: anchor.y }
      } else if (anchor.pos === 'bl') {
        translate = 'translate(0%, -100%)'
        max = { w: 100 - anchor.x, h: anchor.y }
      } else if (anchor.pos === 'cl') {
        translate = 'translate(0%, -50%)'
        max = { w: 100 - anchor.x, h: 2 * Math.min(100 - anchor.y, anchor.y) }
      } else if (anchor.pos === 'cc') {
        translate = 'translate(-50%, -50%)'
        max = { w: 2 * Math.min(100 - anchor.x, anchor.x), h: 2 * Math.min(100 - anchor.y, anchor.y) }
      }

      return {
        'top': `${anchor.y}%`,
        'left': `${anchor.x}%`,
        'max-width': `${max.w}%`,
        'max-height': `${max.h}%`,
        'transform': translate,
        'z-index': (typeof wmZorder === 'number') ? wmZorder : undefined
      }
    })

    const actionsPosition = computed(() => {
      const { anchor } = props.config

      if (anchor.x <= 50 && anchor.y <= 50) {
        return {
          top: '0',
          left: '100%'
        }
      }
      if (anchor.x >= 50 && anchor.y <= 50) {
        return {
          top: '0',
          right: '100%'
        }
      }
      if (anchor.x >= 50 && anchor.y >= 50) {
        return {
          bottom: '0',
          right: '100%'
        }
      }
      if (anchor.x <= 50 && anchor.y >= 50) {
        return {
          bottom: '0',
          left: '100%'
        }
      }
    })

    const shownHandles = computed(() => {
      if (Array.isArray(props.moveHandles)) {
        return props.moveHandles
      }
      if (!props.moveHandles) {
        return ['tl', 'tc', 'tr', 'cr', 'br', 'bc', 'bl', 'cl', 'cc']
      }
      if (props.moveHandles === 'center') {
        return ['cc']
      }
      if (props.moveHandles === 'corners') {
        return ['tl', 'tr', 'br', 'bl']
      }
      if (props.moveHandles === 'top-bottom') {
        return ['tl', 'tc', 'tr', 'br', 'bc', 'bl']
      }
      // Deathloom fork: one position name ("tl") was silently no handles at all
      if (['tl', 'tc', 'tr', 'cr', 'br', 'bc', 'bl', 'cl', 'cc'].includes(props.moveHandles)) {
        return [props.moveHandles]
      }
      return []
    })

    function startMove (pos: string, e: MouseEvent) {
      props.config.anchor.pos = pos
      updatePosition(e)
      document.addEventListener('mousemove', updatePosition)
      document.addEventListener('mouseup', endMove)

      function endMove () {
        document.removeEventListener('mousemove', updatePosition)
        document.removeEventListener('mouseup', endMove)
      }
    }

    function updatePosition (e: MouseEvent) {
      props.config.anchor.x = Math.min(Math.max(e.clientX / window.innerWidth, 0), 1) * 100
      props.config.anchor.y = Math.min(Math.max(e.clientY / window.innerHeight, 0), 1) * 100
    }

    const isEditing = ref(false)
    const isMoving = ref(false)

    function startGripDrag (e: MouseEvent) {
      const start = { cx: e.clientX, cy: e.clientY, x: props.config.anchor.x, y: props.config.anchor.y }
      const clamp = (v: number) => Math.min(Math.max(v, 0), 100)
      function onMove (ev: MouseEvent) {
        props.config.anchor.x = clamp(start.x + (ev.clientX - start.cx) / window.innerWidth * 100)
        props.config.anchor.y = clamp(start.y + (ev.clientY - start.cy) / window.innerHeight * 100)
      }
      function onUp () {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    const { t } = useI18n()

    return {
      t,
      moverPosition,
      widgetPosition,
      actionsPosition,
      handleMouseDown () {
        // @TODO: why null check?
        if (props.config.wmId != null) {
          wm.bringToTop(props.config.wmId)
        }
      },
      startMove,
      startGripDrag,
      isMoving,
      isEditing,
      isHandleShown (pos: string) {
        return props.config.anchor.pos !== pos &&
          shownHandles.value.includes(pos)
      },
      hide () {
        wm.hide(props.config.wmId)
      },
      toggleEdit () {
        isMoving.value = false
        if (props.inlineEdit) {
          isEditing.value = !isEditing.value
        } else {
          const settings = wm.widgets.value.find(w => w.wmType === 'settings')!
          wm.setFlag(settings.wmId, `settings::widget=${props.config.wmId}`, true)
          wm.show(settings.wmId)
        }
      },
      toggleMove () {
        isMoving.value = !isMoving.value
        isEditing.value = false
      },
      ...useRemovable(() => {
        wm.remove(props.config.wmId)
      })
    }
  }
})
</script>

<style lang="postcss" module>
.widget {
  position: absolute;
  display: flex;

  &:not(:hover) {
    .actionsPanel {
      display: none;
    }
  }
}

.actionsPanel {
  @apply py-1;
  color: #fff;
  background: rgba(0,0,0, 0.4);
  display: flex;
  flex-direction: column;
  @apply rounded;
}

.action {
  @apply px-1;
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: rgba(255,255,255, 0.15);
  }

  &.active {
    background: rgba(0,0,0, 0.6);
  }

  &.removable {
    background: linear-gradient(to left, transparent 50%, theme('colors.red.600') 50%);
    background-size: 250% 100%;
    background-position: right bottom;
  }

  &.removing {
    background-size: 200% 100%;
    transition: background-position 1s ease-out;
    background-position: left bottom;
  }
}

.grip {
  @apply flex items-center justify-center gap-x-2 px-2 rounded-t bg-gray-900 text-gray-600 text-xs;
  cursor: move;
  user-select: none;
  min-height: 1rem;

  &:hover {
    @apply text-gray-400;
  }
}

.mover {
  position: absolute;
  /* top: max(0%, min(calc(y% - (1rem/2)), calc(100% - 1rem))); */
  /* left: max(0%, min(calc(x% - (1rem/2)), calc(100% - 1rem))); */
  width: 1rem;
  height: 1rem;
  border: 0.25rem solid rgba(0, 0, 0, 0.6);
  background: rgba(0,0,0,0.2);
  cursor: move;
  user-select: none;

  &.active {
    position: fixed;
    border-color: #fff;
    box-shadow: 0 1px 3px 0 rgb(0, 0, 0),
                0 1px 2px 0 rgb(0, 0, 0);
  }
}
</style>

<style lang="postcss">
.widget-default-style {
  @apply rounded;
  @apply bg-gray-900;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.75),
              0 1px 2px 0 rgba(0, 0, 0, 0.75);
}
</style>
