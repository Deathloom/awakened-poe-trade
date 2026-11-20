<template>
  <!-- Deathloom fork: Path of Building settings (build impact, folders, player).
       Hotkeys are in Hotkeys, panel placement in Panels, startup and updates in General. -->
  <div class="max-w-2xl p-2">
    <div class="mb-4">
      <ui-toggle v-model="pob.enabled">Show build impact when price-checking</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Runs Path of Building in the background and shows what an item does to your active build
        (the same numbers as PoB's item tooltip).
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Path of Building folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.pobDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.pobDir ? `Default: ${defaults.pobDir}` : 'e.g. C:\\Games\\PathOfBuilding'">
        <button type="button" @click="browsePobDir" class="ui-btn shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">
        The folder that contains <code>src</code> and <code>runtime\PoBHeadless.exe</code>.
        Leave empty to use Orbhoarder's own Path of Building (downloaded once, keeps itself up to date; tray menu → Open Path of Building).
      </div>
      <PobInstallStatus v-if="!pob.pobDir" class="mt-2" />
      <!-- Deathloom fork: bring builds over from another Path of Building -->
      <div class="mt-2 p-2 rounded bg-gray-900">
        <div class="mb-1"><i class="fas fa-file-import mr-1" />Copy builds from another Path of Building</div>
        <div class="text-gray-500 text-sm mb-2">
          <template v-if="existingPob">Found {{ existingPob.count }} build{{ existingPob.count === 1 ? '' : 's' }} in
            <span class="break-all text-gray-400">{{ existingPob.buildsDir }}</span>.</template>
          <template v-else>No other Path of Building found in Documents. Pick its builds folder yourself.</template>
          Copied into your Orbhoarder builds{{ defaults.player || pob.player ? ` (folder ${pob.player || defaults.player})` : '' }}; the originals stay
          where they are, builds with the same name are skipped. With build sync on, they're uploaded too.
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="ui-btn" :disabled="copying || !existingPob" @click="copyBuilds()">{{ copying ? 'Copying…' : 'Copy builds' }}</button>
          <button type="button" class="ui-btn" :disabled="copying" @click="copyFromFolder">Choose folder…</button>
          <span v-if="copyResult" class="text-sm" :class="copyResult.ok ? 'text-green-500' : 'text-red-400'">{{ copyResult.text }}</span>
        </div>
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Builds folder</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.buildsDir"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.buildsDir ? `Default: ${defaults.buildsDir}` : 'e.g. C:\\Games\\poe-builds\\poe1'">
        <button type="button" @click="browseBuildsDir" class="ui-btn shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">Leave empty for the builds folder of Orbhoarder's own Path of Building.</div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Player</div>
      <div class="flex gap-1">
        <input v-model.trim="pob.player"
        class="rounded bg-gray-900 px-1 flex-1 min-w-0 font-sans placeholder:text-gray-600 placeholder:italic" :placeholder="defaults.player ? `Default: ${defaults.player}` : 'your GitHub name (empty: no player folder)'">
        <button type="button" @click="browsePlayer" class="ui-btn shrink-0">Browse…</button>
      </div>
      <div class="text-gray-500 text-sm mt-1">
        Your folder in the builds folder (Browse… picks it and fills in the name). Its <code>active.txt</code> names the build to compare against.
        Changes are picked up automatically after a Pull in PoB.
        Leave empty to use the player folder from PoB's build sharing (Sync…), or the builds folder itself if you don't share builds.
      </div>
    </div>
    <div class="mt-4 mb-2 text-gray-500 text-sm">
      Comparing with your live character (equipped gear, tree, gems, following the character you play) is
      turned off: GGG's rules don't allow shared apps to read character data from pathofexile.com outside
      its official API. Everything compares with your PoB build. It can come back once GGG reopens app
      registration for its official API.
    </div>

  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import PobInstallStatus from '@/web/pob/PobInstallStatus.vue'
import { configProp } from './utils'
import { Host } from '@/web/background/IPC'
import { usePobConfig } from './pob-config'

export default defineComponent({
  name: 'Path of Building',
  components: { UiToggle, PobInstallStatus },
  props: configProp(),
  setup (props) {
    const pob = usePobConfig(() => props.config)

    let nextId = 1

    // What empty fields fall back to (bundled PoB, Documents\Loot Goblin\Builds, PoB's sync player)
    const defaults = ref({ pobDir: '', buildsDir: '', player: '' })
    {
      const requestId = nextId++
      const listener = Host.onEvent('MAIN->CLIENT::pob-defaults', (e) => {
        if (e.requestId !== requestId) return
        listener.abort()
        defaults.value = { pobDir: e.pobDir, buildsDir: e.buildsDir, player: e.player }
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-defaults', payload: { requestId } })
    }
    const buildsDir = () => pob.value.buildsDir || defaults.value.buildsDir
    function pickFolder (title: string, defaultPath: string): Promise<string | null> {
      const requestId = nextId++
      return new Promise((resolve) => {
        const listener = Host.onEvent('MAIN->CLIENT::pob-pick-folder', (e) => {
          if (e.requestId !== requestId) return
          listener.abort()
          resolve(e.path)
        })
        Host.sendEvent({
          name: 'CLIENT->MAIN::pob-pick-folder',
          payload: { requestId, title, defaultPath }
        })
      })
    }

    function joinPath (dir: string, name: string) {
      return dir ? dir.replace(/[\\/]+$/, '') + '\\' + name : name
    }
    function baseName (p: string) {
      return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
    }

    // Builds of an earlier Path of Building (found in Documents) or a folder the player picks
    const existingPob = ref<{ buildsDir: string, count: number } | null>(null)
    function probeExisting () {
      const requestId = nextId++
      const listener = Host.onEvent('MAIN->CLIENT::pob-setup-probe', (e) => {
        if (e.requestId !== requestId) return
        listener.abort()
        existingPob.value = e.existingPob ?? null
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-setup-probe', payload: { requestId } })
    }
    probeExisting()
    const copying = ref(false)
    const copyResult = ref<{ ok: boolean, text: string } | null>(null)
    function copyBuilds (source?: string) {
      if (copying.value) return
      copying.value = true
      copyResult.value = null
      const requestId = nextId++
      const listener = Host.onEvent('MAIN->CLIENT::pob-copy-builds', (e) => {
        if (e.requestId !== requestId) return
        listener.abort()
        copying.value = false
        copyResult.value = e.ok
          ? { ok: true, text: `Copied ${e.copied ?? 0}${e.skipped ? `, ${e.skipped} already there` : ''}.` }
          : { ok: false, text: e.error ?? 'Copy failed' }
        probeExisting()
      })
      Host.sendEvent({ name: 'CLIENT->MAIN::pob-copy-builds', payload: { requestId, source } })
    }

    return {
      pob,
      defaults,
      existingPob,
      copying,
      copyResult,
      copyBuilds,
      async copyFromFolder () {
        const picked = await pickFolder('Builds folder of the other Path of Building', existingPob.value?.buildsDir ?? '')
        if (picked) copyBuilds(picked)
      },
      async browsePobDir () {
        const picked = await pickFolder('Path of Building folder', pob.value.pobDir || defaults.value.pobDir)
        if (picked) pob.value.pobDir = picked
      },
      async browseBuildsDir () {
        const picked = await pickFolder('Builds folder (poe-builds\\poe1)', buildsDir())
        if (picked) pob.value.buildsDir = picked
      },
      async browsePlayer () {
        const player = pob.value.player || defaults.value.player
        const start = player ? joinPath(buildsDir(), player) : buildsDir()
        const picked = await pickFolder('Your player folder', start)
        if (!picked) return
        const parent = picked.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
        // a player folder outside the current builds folder moves the builds folder too
        if (parent.toLowerCase() !== buildsDir().replace(/[\\/]+$/, '').toLowerCase()) {
          pob.value.buildsDir = parent
        }
        pob.value.player = baseName(picked)
      }
    }
  }
})
</script>
