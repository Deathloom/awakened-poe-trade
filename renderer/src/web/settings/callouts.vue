<template>
  <!-- Deathloom fork (Q28): spoken callouts (web/callouts) -->
  <div class="max-w-2xl p-2 text-sm">
    <div class="text-base mb-1">Spoken callouts</div>
    <div class="text-gray-500 mb-2">
      A voice says what just happened, so you needn't look away from the fight. Uses the voices installed in Windows
      (Settings → Time &amp; language → Speech to add more); the words never leave this PC. Callouts only react to things
      Orbhoarder already sees: nothing is read from the game and nothing is sent to it. Changes apply straight away (no need to press Save).
    </div>
    <div v-if="!supported" class="text-yellow-300">Not available here (only on the PC).</div>
    <template v-else>
      <ui-toggle :modelValue="s.on" @update:modelValue="(on: boolean) => set({ on })">Spoken callouts</ui-toggle>

      <div class="mt-3 grid gap-x-3 gap-y-1 items-center" style="grid-template-columns: max-content 1fr;" :class="{ 'opacity-50': !s.on }">
        <span>Voice</span>
        <select class="p-1 rounded bg-gray-900 border border-gray-700" :value="s.voice" @change="set({ voice: ($event.target as HTMLSelectElement).value })">
          <option value="">Windows default</option>
          <option v-for="v of voices" :key="v.name" :value="v.name">{{ v.name }} ({{ v.lang }})</option>
        </select>
        <span>Speed</span>
        <div class="flex items-center gap-2">
          <input type="range" min="0.5" max="2" step="0.1" :value="s.rate" @input="set({ rate: Number(($event.target as HTMLInputElement).value) })">
          <span class="text-gray-400">{{ s.rate.toFixed(1) }}×</span>
        </div>
        <span>Volume</span>
        <div class="flex items-center gap-2">
          <input type="range" min="0" max="1" step="0.05" :value="s.volume" @input="set({ volume: Number(($event.target as HTMLInputElement).value) })">
          <span class="text-gray-400">{{ Math.round(s.volume * 100) }} %</span>
        </div>
      </div>
      <div v-if="!voices.length" class="text-yellow-300 mt-1">No Windows voices found, so nothing will be said. Add one in Windows Settings → Time &amp; language → Speech.</div>
      <button class="ui-btn mt-2" :disabled="!voices.length" @click="test"><i class="fas fa-volume-up mr-1" />Test</button>

      <div class="mt-3 mb-1 font-semibold">Say</div>
      <div v-for="c of kinds" :key="c.k" class="mb-1" :class="{ 'opacity-50': !s.on }">
        <ui-toggle :modelValue="s.kinds[c.k]" @update:modelValue="(on: boolean) => set({ kinds: { ...s.kinds, [c.k]: on } })">{{ c.label }}</ui-toggle>
        <div class="text-gray-500 ml-8">{{ c.help }}</div>
      </div>
      <div class="text-gray-500 mt-2">At most one callout every few seconds; the same words aren't repeated within 30 seconds. Heard from the overlay, so the game must be running with Orbhoarder.</div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onUnmounted, shallowRef } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { configProp } from './utils'
import { CALLOUT_KINDS, type CalloutSettings } from '../callouts/callouts'
import { calloutSettings, setCalloutSettings, canSpeak, localVoices, speakNow } from '../callouts/callouts-store'

export default defineComponent({
  name: 'Spoken callouts',
  components: { UiToggle },
  props: configProp(),
  setup () {
    const supported = canSpeak()
    const voices = shallowRef<SpeechSynthesisVoice[]>(localVoices())
    // Chromium fills the voice list a moment after start
    const onVoices = () => { voices.value = localVoices() }
    if (supported) window.speechSynthesis.addEventListener('voiceschanged', onVoices)
    onUnmounted(() => { if (supported) window.speechSynthesis.removeEventListener('voiceschanged', onVoices) })

    const s = computed(() => calloutSettings.value)
    const set = (patch: Partial<CalloutSettings>) => { setCalloutSettings(patch) }
    function test () {
      window.speechSynthesis.cancel()
      speakNow('Trade: Headhunter, for 120 divine')
    }
    return { supported, voices, s, set, test, kinds: CALLOUT_KINDS }
  }
})
</script>
