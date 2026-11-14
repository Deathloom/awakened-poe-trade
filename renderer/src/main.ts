import { createApp, watch } from 'vue'
import App from './web/App.vue'
import * as I18n from './web/i18n'
import * as Data from './assets/data'
import { initConfig, AppConfig } from './web/Config'
import { Host } from './web/background/IPC'

;(async function () {
  await initConfig()
  const i18nPlugin = await I18n.init(AppConfig().language)
  await Data.init(AppConfig().language)
  await Host.init()

  watch(() => AppConfig().language, async () => {
    await Data.loadForLang(AppConfig().language)
    await I18n.loadLang(AppConfig().language)
  })

  // Deathloom fork: errors in the overlay pages go into the automatic problem report
  const qs = new URLSearchParams(location.search)
  const where = qs.get('hud') ? `hud=${qs.get('hud')}` : qs.has('desktop') ? 'desktop' : 'overlay'
  const report = (err: unknown, extra?: string) => {
    const e = err instanceof Error ? err : new Error(String(err))
    Host.sendEvent({ name: 'CLIENT->MAIN::report-error', payload: { message: e.message, stack: e.stack, where: extra ? `${where}, ${extra}` : where } })
  }
  window.addEventListener('error', (ev) => { report(ev.error ?? ev.message) })
  window.addEventListener('unhandledrejection', (ev) => { report(ev.reason) })

  // Deathloom fork: the overlay window runs as long as Loot Goblin does; it
  // records character levels from Client.txt for the levelling planner
  if (where === 'overlay') {
    const { startLevelRecorder } = await import('./web/companion/char-level')
    startLevelRecorder()
  }

  const app = createApp(App)
  app.config.errorHandler = (err, instance, info) => {
    console.error(err)
    report(err, `${instance?.$options.name ?? instance?.$options.__name ?? 'component'} ${info}`)
  }
  app
    .use(i18nPlugin)
    .mount('#app')
})()
