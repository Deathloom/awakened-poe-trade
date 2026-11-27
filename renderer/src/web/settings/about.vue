<template>
  <div class="p-2 flex flex-col h-full items-center">
    <div class="flex flex-col items-center p-2 mb-4">
      <img class="w-20 h-20 logo-float" src="/images/orbhoarder.svg" alt="Orbhoarder">
      <p class="text-base">Orbhoarder</p>
      <p class="text-gray-500">based on <a class="border-b" href="https://github.com/SnosMe/awakened-poe-trade" target="_blank">Awakened PoE Trade</a> by SnosMe (MIT)</p>
      <p class="">{{ t('app.version', [version]) }}</p>
      <p class="text-gray-500 text-sm text-center max-w-md mt-1">Not affiliated with or endorsed by Grinding Gear Games.
        Path of Exile is a trademark of Grinding Gear Games. Free, for friends; nothing is sold.</p>
      <div class="flex gap-2">
        <a class="border-b" href="https://github.com/Deathloom/awakened-poe-trade/releases" target="_blank">{{ t('app.release_notes') }}</a>
        <a class="border-b" href="https://github.com/Deathloom/awakened-poe-trade/issues" target="_blank">{{ t('app.report_bug') }}</a>
      </div>
    </div>
    <div class="border border-gray-600 rounded p-2 whitespace-nowrap min-w-min w-72">
      <p>{{ info.str1 }}</p>
      <p>{{ info.str2 }}</p>
      <button v-if="info.action" @click="info.action"
        class="btn w-full mt-1">{{ info.actionText }}</button>
    </div>
    <!-- Deathloom fork (layout review step 6): help surfaces of the Orbhoarder window
         in one place (they were buttons at the bottom of its Settings) -->
    <div v-if="isDesktop" class="flex flex-wrap justify-center gap-2 mt-4">
      <button class="btn" title="How to use Orbhoarder, where to get a build, FAQ (Reference → Help)" @click="openHelp"><i class="fas fa-question-circle mr-1" />Help</button>
      <button class="btn" title="Changes in the latest Orbhoarder versions" @click="whatsNew"><i class="fas fa-gift mr-1" />What's new</button>
      <button v-if="!isDesktop2" class="btn" title="A one-minute tour of this window's tabs and the in-game hotkeys" @click="tour"><i class="fas fa-route mr-1" />Take the tour</button>
      <button class="btn" title="The first-run setup guide (build sharing, folders, panels, trade buttons)" @click="setupGuide"><i class="fas fa-magic mr-1" />Run setup guide</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Host } from '@/web/background/IPC'
import { DateTime } from 'luxon'
import { IS_DESKTOP, IS_DESKTOP2 } from '@/web/hud/is-hud'
import { desktopSetupShown } from '../setup/setup-state'
import { whatsNewRequested } from '../whats-new/whats-new-state'
import { tourOpen } from '../onboarding/tour-state'

function checkForUpdates () {
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-action',
    payload: { action: 'check-for-update' }
  })
}

function openDownloadPage () {
  window.open('https://github.com/Deathloom/awakened-poe-trade/releases/latest')
}

function quitAndInstall () {
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-action',
    payload: { action: 'update-and-restart' }
  })
}

function fmtTime (millis: number) {
  return DateTime.fromMillis(millis).toRelative({ style: 'long' }) ?? 'n/a'
}

export default defineComponent({
  name: 'settings.about',
  inheritAttrs: false,
  setup () {
    const { t } = useI18n()

    // Deathloom fork: offer "Check again" if checking shows for over 20 s
    const slowCheck = ref(false)
    let slowTimer: ReturnType<typeof setTimeout> | undefined
    watch(() => Host.updateInfo.value.state, (st) => {
      clearTimeout(slowTimer)
      slowCheck.value = false
      if (st === 'checking-for-update') slowTimer = setTimeout(() => { slowCheck.value = true }, 20_000)
    }, { immediate: true })
    onUnmounted(() => { clearTimeout(slowTimer) })

    const info = computed(() => {
      const rawInfo = Host.updateInfo.value
      switch (rawInfo.state) {
        case 'initial':
          return { str1: t('updates.maybe_outdated'), str2: t('updates.never_checked'), action: checkForUpdates, actionText: t('updates.check_now') }
        case 'checking-for-update':
          // Deathloom fork: never leave a dead end on screen
          return slowCheck.value
            ? { str1: t('updates.checking'), str2: 'Taking longer than usual.', action: checkForUpdates, actionText: 'Check again' }
            : { str1: t('updates.checking'), str2: t('please_wait') }
        case 'update-not-available':
          return { str1: t('updates.latest'), str2: t('updates.last_checked', [fmtTime(rawInfo.checkedAt)]), action: checkForUpdates, actionText: t('updates.check_now') }
        case 'error':
          // Deathloom fork: try again from here (the releases page is linked above)
          return { str1: t('updates.maybe_outdated'), str2: "Couldn't reach GitHub to check.", action: checkForUpdates, actionText: 'Check again' }
        case 'update-downloaded':
          return { str1: t('updates.available', [rawInfo.version]), str2: t('updates.installed_on_exit'), action: quitAndInstall, actionText: t('updates.install_now') }
        case 'update-available':
          return (rawInfo.noDownloadReason)
            ? { str1: t('updates.available', [rawInfo.version]), str2: (rawInfo.noDownloadReason === 'not-supported') ? t('updates.download_manually') : t('updates.download_disabled'), action: openDownloadPage, actionText: t('updates.downloads_page') }
            : { str1: t('updates.available', [rawInfo.version]), str2: t('updates.downloading') }
      }
    })

    return {
      t,
      info,
      version: Host.version,
      isDesktop: IS_DESKTOP,
      isDesktop2: IS_DESKTOP2,
      openHelp: () => { Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-window-view', view: 'help' } }) },
      whatsNew: () => { whatsNewRequested.value++ },
      tour: () => { tourOpen.value = true },
      setupGuide: () => { desktopSetupShown.value = true }
    }
  }
})
</script>

<style scoped>
/* Deathloom fork: the logo bobs gently (not with "reduce motion") */
.logo-float { animation: logo-float 4s ease-in-out infinite; filter: drop-shadow(0 6px 10px rgb(0 0 0 / .5)); }
@keyframes logo-float { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(2deg); } }
@media (prefers-reduced-motion: reduce) { .logo-float { animation: none; } }
</style>
