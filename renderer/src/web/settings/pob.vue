<template>
  <!-- Deathloom fork: Path of Building build impact settings -->
  <div class="max-w-md p-2">
    <div class="mb-4">
      <ui-toggle v-model="pob.enabled">Show build impact when price-checking</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Runs Path of Building in the background and shows what an item does to your active build
        (the same numbers as PoB's item tooltip).
      </div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Path of Building folder</div>
      <input v-model.trim="pob.pobDir"
        class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. D:\Claude Projects\PathOfBuilding">
      <div class="text-gray-500 text-sm mt-1">The folder that contains <code>src</code> and <code>runtime\PoBHeadless.exe</code>.</div>
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Builds folder</div>
      <input v-model.trim="pob.buildsDir"
        class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. D:\Claude Projects\poe-builds\poe1">
    </div>
    <div class="mb-2">
      <div class="flex-1 mb-1">Player</div>
      <input v-model.trim="pob.player"
        class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. Deathloom">
      <div class="text-gray-500 text-sm mt-1">
        Your folder in the builds folder. Its <code>active.txt</code> names the build to compare against.
        Changes are picked up automatically after a Pull in PoB.
      </div>
    </div>
    <div class="mt-4 mb-2">
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Build gear panel hotkey</span>
        <hotkey-input v-model="pob.gearPanelKey" class="w-48" />
      </div>
      <div class="text-gray-500 text-sm">
        Shows the active build's items in the overlay (also in the widget menu, hammer icon).
        Copy puts the unique name or base type on the clipboard for the in-game market
        (press <code>/</code>, then Ctrl+V); the app never types into the game.
        The same Copy button is on the price check window.
      </div>
    </div>
    <div class="mt-4 mb-2">
      <ui-toggle v-model="pob.liveGear">Also compare with my equipped gear</ui-toggle>
      <div class="text-gray-500 text-sm mt-1">
        Reads your character's gear from your public Characters tab on pathofexile.com
        (no login; at most once every 2 minutes, or when you press refresh in the panel).
        Your profile's Characters tab must be public. PoB's config (enemy, buffs, bandit, pantheon)
        always comes from the build.
      </div>
    </div>
    <template v-if="pob.liveGear">
      <div class="mb-2">
        <div class="flex-1 mb-1">Account name</div>
        <input v-model.trim="pob.accountName"
          class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. Deathloom#1234">
        <div class="text-gray-500 text-sm mt-1">Including the <code>#1234</code> part, as shown on your profile.</div>
      </div>
      <div class="mb-2">
        <div class="flex-1 mb-1">Character</div>
        <input v-model.trim="pob.character"
          class="rounded bg-gray-900 px-1 block w-full font-sans placeholder:text-gray-600 placeholder:italic" placeholder="e.g. DeathloomAW">
      </div>
      <div class="mb-2">
        <ui-toggle v-model="pob.liveTreeAndGems">Use the character's passive tree, level and gems too</ui-toggle>
        <div class="text-gray-500 text-sm mt-1">
          On: "vs character" is your actual character (one extra request per refresh for the tree).
          Off: only the items are swapped into the build. The main skill is the build's main skill
          if the character has it, otherwise PoB's guess.
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import HotkeyInput from './HotkeyInput.vue'
import { configProp } from './utils'
import { defaultPobConfig } from '@/web/Config'

export default defineComponent({
  name: 'Path of Building',
  components: { UiToggle, HotkeyInput },
  props: configProp(),
  setup (props) {
    return {
      pob: computed(() => {
        props.config.pob ??= defaultPobConfig()
        return props.config.pob
      })
    }
  }
})
</script>
