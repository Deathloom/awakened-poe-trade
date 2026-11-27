<script lang="ts">
// Deathloom fork (Q28): spoken callouts; mounted once, in the overlay window (renders nothing)
import { defineComponent, onUnmounted } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from '@/web/companion/game-log'
import { callout, enableSpeaker } from './callouts-store'
import { whisperCallout, priceAlertCallout, healthCallout } from './callouts'

export default defineComponent({
  name: 'CalloutsSpeaker',
  setup () {
    enableSpeaker()
    const subs = [
      Host.onEvent('MAIN->CLIENT::game-log', (e) => {
        const lang = AppConfig().language
        for (const line of e.lines) {
          const ev = parseLogLine(line, lang)
          if (ev?.type === 'trade') callout('whisper', whisperCallout(ev))
        }
      }),
      Host.onEvent('MAIN->CLIENT::price-alert-fired', (e) => {
        const f = e.fired[0]
        if (!f) return
        callout('priceAlert', e.fired.length > 1 ? `${e.fired.length} price alerts fired` : priceAlertCallout(f))
      }),
      Host.onEvent('MAIN->CLIENT::health-warning', (w) => {
        callout('health', healthCallout(w.text))
      })
    ]
    onUnmounted(() => { for (const s of subs) s.abort() })
    return () => null
  }
})
</script>
