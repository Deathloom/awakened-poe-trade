<template>
  <div id="app" class="text-sm font-poe-sc">
    <HudApp v-if="IS_HUD" />
    <OverlayWindow v-else />
  </div>
</template>

<script setup lang="ts">
import OverlayWindow from './overlay/OverlayWindow.vue'
import HudApp from './hud/HudApp.vue'
import { IS_HUD } from './hud/is-hud'
import { Host } from './background/IPC'
import { AppConfig, saveConfig, pushHostConfig } from './Config'
import { openTradeSearch, openPriceCheck } from './pob/gear-actions'

// Deathloom fork: the HUD window was dragged; the overlay owns the settings file
if (!IS_HUD) {
  Host.onEvent('MAIN->CLIENT::hud-moved', (e) => {
    const hud = AppConfig().pob?.hud
    if (!hud) return
    hud.pos = { ...hud.pos, [e.panel]: { x: e.x, y: e.y } }
    saveConfig()
  })
  // build gear panel pinned in the HUD window: Trade / price check / loadout choice
  Host.onEvent('MAIN->CLIENT::hud-gear-action', (e) => {
    if (e.action === 'trade' && e.text) {
      const err = openTradeSearch(e.text)
      if (err) console.warn('[HUD gear] ' + err)
    } else if (e.action === 'price-check' && e.text) {
      openPriceCheck(e.text, { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 3) })
    } else if (e.action === 'loadouts' && e.loadouts) {
      AppConfig().pob.loadouts = e.loadouts
      saveConfig()
      pushHostConfig()
    }
  })
}
</script>

<style lang="postcss">
@import url('@fortawesome/fontawesome-free/css/all.min.css');
@import url('animate.css/animate.css');
@import url('../assets/font.css');
@tailwind base;
@tailwind components;
@tailwind utilities;

.table-stripped tbody tr:nth-child(odd) {
  background: #353f52;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* align-items: center; */
  overflow: hidden;
  justify-content: space-between;

  :focus {
    outline: 0;
  }
}

.layout-column {
  display: flex;
  flex-direction: column;
  height: 100%;
}

::-webkit-scrollbar {
  width: 0.875rem;
}

::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 0.375rem rgba(0,0,0,0.3);
}

::-webkit-scrollbar-thumb {
  -webkit-box-shadow: inset 0 0 0.375rem rgba(0,0,0,0.5);
}

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.btn {
  @apply bg-gray-700;
  @apply px-2 py-1;
  @apply text-gray-400;
  @apply leading-none;
  @apply rounded;
}

.btn-icon {
  @apply text-xs text-gray-600;
}

@keyframes ring {
  0% {
    -webkit-transform: rotate(-15deg);
    -ms-transform: rotate(-15deg);
    transform: rotate(-15deg);
  }

  2% {
    -webkit-transform: rotate(15deg);
    -ms-transform: rotate(15deg);
    transform: rotate(15deg);
  }

  4% {
    -webkit-transform: rotate(-18deg);
    -ms-transform: rotate(-18deg);
    transform: rotate(-18deg);
  }

  6% {
    -webkit-transform: rotate(18deg);
    -ms-transform: rotate(18deg);
    transform: rotate(18deg);
  }

  8% {
    -webkit-transform: rotate(-22deg);
    -ms-transform: rotate(-22deg);
    transform: rotate(-22deg);
  }

  10% {
    -webkit-transform: rotate(22deg);
    -ms-transform: rotate(22deg);
    transform: rotate(22deg);
  }

  12% {
    -webkit-transform: rotate(-18deg);
    -ms-transform: rotate(-18deg);
    transform: rotate(-18deg);
  }

  14% {
    -webkit-transform: rotate(18deg);
    -ms-transform: rotate(18deg);
    transform: rotate(18deg);
  }

  16% {
    -webkit-transform: rotate(-12deg);
    -ms-transform: rotate(-12deg);
    transform: rotate(-12deg);
  }

  18% {
    -webkit-transform: rotate(12deg);
    -ms-transform: rotate(12deg);
    transform: rotate(12deg);
  }

  20% {
    -webkit-transform: rotate(0deg);
    -ms-transform: rotate(0deg);
    transform: rotate(0deg);
  }
}

.faa-ring {
  animation: ring 2s ease;
  transform-origin-x: 50%;
  transform-origin-y: 0px;
  transform-origin-z: initial;
}
</style>
