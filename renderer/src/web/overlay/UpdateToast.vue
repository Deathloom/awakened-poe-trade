<template>
  <!-- Deathloom fork: update notice shown over the game (Windows hides its own notifications while a game runs full screen) -->
  <transition
    enter-active-class="animate__animated animate__fadeIn"
    leave-active-class="animate__animated animate__fadeOut">
    <div :class="$style.widget" v-if="text">
      <div :class="$style.box">
        <div class="py-2 px-4">
          <div class="text-base">Loot Goblin</div>
          <p>{{ text }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'

const text = shallowRef('')
let timer: ReturnType<typeof setTimeout> | undefined
const shown = new Set<string>()

function flash (key: string, msg: string, ms: number) {
  if (shown.has(key)) return
  shown.add(key)
  text.value = msg
  clearTimeout(timer)
  timer = setTimeout(() => { text.value = '' }, ms)
}

Host.onEvent('MAIN->CLIENT::updater-state', (info) => {
  if (info.state === 'update-available' && info.noDownloadReason == null) {
    flash(`dl:${info.version}`, `Downloading update ${info.version}…`, 4000)
  } else if (info.state === 'update-downloaded') {
    flash(`ok:${info.version}`, `Update ${info.version} is ready. It installs when you close the game (or tray → Restart to update).`, 8000)
  }
})
</script>

<style lang="postcss" module>
.widget {
  position: absolute;
  display: flex;
  width: 100%;
  justify-content: center;
  bottom: 12%;
}

.box {
  position: relative;
  display: flex;
  @apply bg-gray-800;
  @apply text-gray-100;
  @apply rounded;
  box-shadow: 0px 0px 1px 2px rgb(255 255 255 / 20%);
}

.box::before {
  position: absolute;
  content: '';
  background: url('/images/TransferOrb.png') no-repeat top right/contain;
  right: 100%;
  width: 100%;
  height: 100%;
  max-width: 78px;
  @apply mr-2;
  pointer-events: none;
  filter: drop-shadow(2px 4px 6px #000);
}
</style>
