<template>
  <div id="app" class="text-sm font-poe-sc">
    <HudApp v-if="IS_HUD" />
    <DesktopApp v-else-if="IS_DESKTOP" />
    <OverlayWindow v-else />
  </div>
</template>

<script setup lang="ts">
import OverlayWindow from './overlay/OverlayWindow.vue'
import HudApp from './hud/HudApp.vue'
import DesktopApp from './desktop/DesktopApp.vue'
import { IS_HUD, IS_DESKTOP } from './hud/is-hud'
import { Host } from './background/IPC'
import { AppConfig, saveConfig, pushHostConfig } from './Config'
import { openTradeSearch, openPriceCheck } from './pob/gear-actions'

// Deathloom fork: the HUD window was dragged; the overlay owns the settings file
// (only the overlay window does these, not the HUD or desktop window)
if (!IS_HUD && !IS_DESKTOP) {
  Host.onEvent('MAIN->CLIENT::hud-moved', (e) => {
    const hud = AppConfig().pob?.hud
    if (!hud) return
    hud.pos = { ...hud.pos, [e.panel]: { x: e.x, y: e.y } }
    saveConfig()
  })
  // a HUD panel was resized by its corner
  Host.onEvent('MAIN->CLIENT::hud-dims', (e) => {
    const hud = AppConfig().pob?.hud
    if (!e.done || !hud) return
    hud.dims = { ...hud.dims, [e.panel]: { w: e.w, h: e.h } }
    saveConfig()
  })
  // build gear panel pinned in the HUD window: Trade / price check / loadout choice
  Host.onEvent('MAIN->CLIENT::hud-gear-action', (e) => {
    if ((e.action === 'trade' || e.action === 'upgrade') && e.text) {
      const err = openTradeSearch(e.text, e.action === 'upgrade')
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
@import url('../assets/animate-lite.css');
@import url('../assets/font.css');
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Deathloom fork: theme variables (Settings → Appearance; src/web/appearance.ts).
   Defaults = Classic, so nothing changes until a theme is picked. */
:root {
  --g-100: 247 250 252; --g-200: 237 242 247; --g-300: 226 232 240;
  --g-400: 203 213 224; --g-500: 160 174 192; --g-600: 113 128 150;
  --g-700: 74 85 104; --g-800: 45 55 72; --g-900: 26 32 44;
  --b-100: 235 248 255; --b-200: 190 227 248; --b-300: 144 205 244;
  --b-400: 99 179 237; --b-500: 66 153 225; --b-600: 49 130 206;
  --b-700: 43 108 176; --b-800: 44 82 130; --b-900: 42 67 101;
  --accent: 66 153 225;
  --round: 1;
  --panel-alpha: 1;
  --ui-font: FontinSmallCaps, FrizQuadrataC;
  --field-bg: #030712;
}
#app.font-poe-sc {
  font-family: var(--ui-font);
}

/* Deathloom fork: text fields stand out from the panel they sit on
   (they used the panel's own grey and were nearly invisible). Only our
   rounded fields; price check filter inputs keep upstream's look. */
:is(input:not([type]), input[type="text"], input[type="search"], input[type="number"], input[type="password"], input[type="url"], textarea, select)[class~="rounded"] {
  background-color: var(--field-bg) !important;
  color: rgb(var(--g-100));
  box-shadow: inset 0 0 0 1px rgb(var(--g-600));
}
:is(input:not([type]), input[type="text"], input[type="search"], input[type="number"], input[type="password"], input[type="url"], textarea, select)[class~="rounded"]:hover {
  box-shadow: inset 0 0 0 1px rgb(var(--g-500));
}
:is(input:not([type]), input[type="text"], input[type="search"], input[type="number"], input[type="password"], input[type="url"], textarea, select)[class~="rounded"]:focus {
  box-shadow: inset 0 0 0 1px rgb(var(--accent)), 0 0 0 1px rgb(var(--accent));
}
:is(input, textarea)[class~="rounded"]::placeholder {
  color: rgb(var(--g-500));
  opacity: 1;
}

.table-stripped tbody tr:nth-child(odd) {
  background: rgb(var(--g-800) / var(--panel-alpha));
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
