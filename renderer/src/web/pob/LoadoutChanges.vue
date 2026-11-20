<template>
  <!-- Deathloom fork (19 Nov 2026): what changes between the loadout you play and another one of this build -->
  <div class="px-2 py-1 text-sm space-y-1">
    <div v-if="!options.length && loaded" class="text-xs text-gray-500">
      This build has one loadout (one tree, gear and skill set), so there's nothing to compare. Builds from guides with
      stages (Early / Mid / Late, Level 30 / 60 / 90…) show the changes between stages here.
    </div>
    <template v-else-if="options.length">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="text-gray-400" title="The loadout picked in the Build panel">Now: <b class="text-gray-200">{{ current?.label ?? 'custom' }}</b></span>
        <span class="text-gray-500">→</span>
        <select v-model="targetKey" class="bg-gray-900 rounded px-1 max-w-[16rem]" title="The loadout you're moving to. Guides don't always go in list order, so pick it yourself.">
          <option value="">Compare with…</option>
          <option v-for="o of options" :key="o.key" :value="o.key" :disabled="o.key === current?.key">{{ o.label }}</option>
        </select>
        <button v-if="target && changes" class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs"
          :title="`Play '${target.label}' from now on (same as picking it in the Build panel)`" @click="switchTo">Switch to {{ target.label }}</button>
      </div>
      <div v-if="error" class="text-red-400 text-xs">{{ error }}</div>
      <div v-else-if="busy" class="text-gray-500 text-xs">Reading the build…</div>
      <div v-else-if="changes && target" class="text-xs space-y-1.5">
        <div v-if="changes.nothing" class="text-gray-400">Nothing to change: both loadouts are the same.</div>
        <div v-if="changes.ascendancyChanges || changes.classChanges" class="rounded bg-yellow-900/40 px-2 py-1 text-yellow-200">
          <i class="fas fa-exclamation-triangle mr-1" />
          {{ changes.classChanges ? 'This loadout is for a different class.' : 'This loadout uses a different ascendancy.' }}
          That's a big step, not a gem swap: check the build guide for when and how to make it.
        </div>

        <section v-if="changes.gems.length">
          <div class="text-gray-300 font-semibold">Gems</div>
          <div v-for="g of changes.gems" :key="g.change + g.name" class="pl-2">
            <span v-if="g.change === 'removed'" class="text-red-300">− {{ g.name }}</span>
            <span v-else-if="g.change === 'added'" class="text-green-300">+ {{ g.name }}<span v-if="g.b" class="text-gray-500"> (lvl {{ g.b }})</span></span>
            <span v-else class="text-gray-300">{{ g.name }} <span class="text-gray-500">lvl {{ g.a }} → {{ g.b }}</span></span>
          </div>
        </section>
        <div v-else-if="!changes.sameSkills && target.own.skills" class="text-gray-500">Gems: no changes.</div>

        <section v-if="changes.take.length || changes.refund.length || changes.masteriesChanged.length">
          <div class="text-gray-300 font-semibold">Passive tree
            <span class="font-normal text-gray-500">· take {{ changes.take.length }}, refund {{ changes.refund.length }}</span></div>
          <div v-if="takeNamed.big.length || takeNamed.small" class="pl-2">
            <span class="text-green-300">Take: </span>
            <span v-for="n of takeNamed.big" :key="n.id" class="mr-2" :class="n.kind === 2 ? 'text-orange-300' : 'text-gray-200'">{{ n.name }}</span>
            <span class="text-gray-500">{{ smallText(takeNamed) }}</span>
          </div>
          <div v-if="refundNamed.big.length || refundNamed.small" class="pl-2">
            <span class="text-red-300" title="Each refund costs an Orb of Regret (or a free respec point)">Refund: </span>
            <span v-for="n of refundNamed.big" :key="n.id" class="mr-2" :class="n.kind === 2 ? 'text-orange-300' : 'text-gray-200'">{{ n.name }}</span>
            <span class="text-gray-500">{{ smallText(refundNamed) }}</span>
          </div>
          <div v-if="changes.masteriesChanged.length" class="pl-2 text-gray-400">{{ changes.masteriesChanged.length }} mastery choice(s) change</div>
          <div v-if="!names.size" class="pl-2 text-gray-500">Passive names come from Path of Building; open the Tree tab once if you only see counts.</div>
        </section>

        <section v-if="changes.gear.length">
          <div class="text-gray-300 font-semibold">Gear</div>
          <div v-for="g of changes.gear" :key="g.slot" class="pl-2">
            <span class="text-gray-400">{{ g.slot }}:</span>
            <span v-if="g.placeholder" class="text-gray-200" title="The guide only names the base for this slot: any good one will do"> {{ g.to }}</span>
            <span v-else class="text-gray-200"> {{ g.to }}</span>
            <div v-for="m of g.add" :key="'+' + m" class="pl-3 text-green-300">+ {{ m }}</div>
            <div v-for="m of g.remove" :key="'-' + m" class="pl-3 text-red-300">− {{ m }}</div>
          </div>
        </section>

        <section v-if="changes.wickerman.length">
          <div class="text-gray-300 font-semibold">Wickerman</div>
          <div v-for="g of changes.wickerman" :key="g.slot" class="pl-2">
            <span class="text-gray-400">{{ g.slot }}:</span> <span class="text-gray-200">{{ g.to }}</span>
            <span v-if="g.from" class="text-gray-500"> (was {{ g.from }})</span>
          </div>
        </section>

        <div class="text-gray-500">
          From what Path of Building last saved in the build file.
          <span v-if="!target.own.items"> This loadout has no gear set of its own: gear isn't compared.</span>
          <span v-if="!target.own.skills"> It has no skill set of its own: gems aren't compared.</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import type { PobLoadouts, PobTreeMapNode } from '@ipc/types'
import { loadoutOptions, currentOption, stageChanges, type StageChanges } from './loadout-steps'

const emit = defineEmits<{ (e: 'changed'): void }>()

const loaded = ref(false)
const buildPath = ref<string | null>(null)
const loadouts = shallowRef<PobLoadouts | null>(null)
const options = computed(() => loadoutOptions(loadouts.value))
const current = computed(() => currentOption(loadouts.value, options.value))
const targetKey = ref('')
const target = computed(() => options.value.find(o => o.key === targetKey.value))
const changes = shallowRef<StageChanges | null>(null)
const busy = ref(false)
const error = ref('')

let reqId = (Date.now() & 0x3ffffff) * 8
const next = () => { reqId += 1; return reqId }
let buildsId = 0
let compareId = 0
let namesId = 0

const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsId) return
  loaded.value = true
  if (!e.ok) { error.value = e.error ?? 'Unknown error'; return }
  buildPath.value = e.list?.active ?? null
  loadouts.value = e.loadouts ?? null
  if (targetKey.value && !options.value.some(o => o.key === targetKey.value)) targetKey.value = ''
  run()
})
const lsCompare = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
  if (e.requestId !== compareId) return
  busy.value = false
  if (!e.ok || !e.a || !e.b) { error.value = e.error ?? 'Unknown error'; changes.value = null; return }
  error.value = ''
  changes.value = stageChanges(e.a, e.b)
})

const names = shallowRef(new Map<number, PobTreeMapNode>())
const lsTree = Host.onEvent('MAIN->CLIENT::pob-tree-map', (e) => {
  if (e.requestId !== namesId || !e.ok || !e.layout) return
  names.value = new Map(e.layout.nodes.map(n => [n[0], n]))
})
onUnmounted(() => { lsBuilds.abort(); lsCompare.abort(); lsTree.abort() })

function request () {
  buildsId = next()
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId } })
}
defineExpose({ request })
request()

function run () {
  changes.value = null
  const from = current.value
  const to = target.value
  if (!buildPath.value || !from || !to) return
  busy.value = true
  compareId = next()
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: compareId, a: buildPath.value, b: buildPath.value, selA: from.sel, selB: to.sel } })
  if (!names.value.size) {
    namesId = next()
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-tree-map', payload: { requestId: namesId } })
  }
}
watch(targetKey, run)

function switchTo () {
  const to = target.value
  if (!to) return
  buildsId = next()
  const setLoadout = to.key.startsWith('n:') ? { named: to.label } : { ...to.sel }
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId, setLoadout } })
  targetKey.value = ''
  emit('changed')
}

interface Named { big: Array<{ id: number, name: string, kind: number }>, small: number, unknown: number }
function named (ids: number[]): Named {
  const out: Named = { big: [], small: 0, unknown: 0 }
  for (const id of ids) {
    const n = names.value.get(id)
    if (!n) out.unknown++
    else if (n[3] === 0 || n[3] >= 5) out.small++
    else out.big.push({ id, name: n[6], kind: n[3] })
  }
  out.big.sort((x, y) => y.kind - x.kind || x.name.localeCompare(y.name))
  return out
}
const takeNamed = computed(() => named(changes.value?.take ?? []))
const refundNamed = computed(() => named(changes.value?.refund ?? []))
function smallText (n: Named) {
  return [n.small ? `+ ${n.small} small passives` : '', n.unknown ? `${n.unknown} more` : ''].filter(Boolean).join(' · ')
}
</script>
