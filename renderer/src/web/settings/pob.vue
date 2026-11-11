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
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { configProp } from './utils'
import { defaultPobConfig } from '@/web/Config'

export default defineComponent({
  name: 'Path of Building',
  components: { UiToggle },
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
