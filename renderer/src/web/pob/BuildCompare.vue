<template>
  <!-- Deathloom fork (idea 6): compare two builds of the player folder (stats,
       gear, gems, passive tree). Read from the build files; nothing is changed. -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1 max-h-[32rem] overflow-y-auto">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-gray-400">Compare builds</span>
      <select v-model="pathA" class="bg-gray-900 rounded px-1 max-w-[14rem]" title="Build A">
        <option value="">Build A…</option>
        <option v-for="p of builds" :key="p" :value="p">{{ label(p) }}</option>
      </select>
      <span class="text-gray-500">vs</span>
      <select v-model="pathB" class="bg-gray-900 rounded px-1 max-w-[14rem]" title="Build B">
        <option value="">Build B…</option>
        <option v-for="p of builds" :key="p" :value="p">{{ label(p) }}</option>
      </select>
      <button class="text-gray-500 hover:text-gray-200" title="Swap A and B" @click="[pathA, pathB] = [pathB, pathA]"><i class="fas fa-exchange-alt" /></button>
      <button class="px-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50" :disabled="busy || !pathA || !pathB || pathA === pathB" @click="run">
        <i v-if="busy" class="fas fa-spinner fa-spin mr-1" />Compare</button>
    </div>
    <!-- Deathloom fork (Gerhard 17 Nov 2026): your character's gear vs this build.
         Path of Building does the import (you click Import in PoB); Orbhoarder only
         reads the saved build file, so it stays within GGG's rules. -->
    <div v-if="active" class="rounded bg-gray-900 px-2 py-1 text-xs text-gray-400">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="text-gray-200"><i class="fas fa-user-check mr-1" />Your character vs this build</span>
        <button v-if="!mineExists" class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:opacity-50" :disabled="busy"
          :title="`Copies '${label(active)}' to '${label(minePath)}' in your folder`" @click="makeMine">1. Make the copy</button>
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="openPob">{{ mineExists ? 'Update gear in' : '2.' }} Path of Building</button>
        <button v-if="mineExists" class="px-2 rounded bg-gray-600 hover:bg-gray-500 text-gray-100 disabled:opacity-50" :disabled="busy" @click="compareMine">Compare gear</button>
      </div>
      <div class="mt-0.5">
        In Path of Building: open <b class="text-gray-300">{{ label(minePath) }}</b> → Import/Export Build → Import character → pick your character →
        <b class="text-gray-300">Items and Skills</b> → Save (Ctrl+S). Then Compare gear. Do it again whenever your gear changes.
      </div>
    </div>
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <div v-if="!error && !result" class="text-xs text-gray-500">Pick two builds from your folder (or a friend's, via Player). Uses what Path of Building last saved in each file.</div>
    <template v-if="result && sumA && sumB">
      <div class="text-xs text-gray-400">
        <span class="text-blue-300">A</span> {{ who(sumA) }} · <span class="text-yellow-300">B</span> {{ who(sumB) }}
      </div>
      <div class="flex gap-1">
        <button v-for="s of sections" :key="s.id" class="px-2 rounded text-xs"
          :class="sec === s.id ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700'" @click="sec = s.id">{{ s.label }}</button>
      </div>

      <table v-if="sec === 'stats'" class="text-xs">
        <tr class="text-gray-500"><th class="text-left font-normal pr-3">Stat</th><th class="text-right font-normal px-2 text-blue-300">A</th><th class="text-right font-normal px-2 text-yellow-300">B</th><th class="text-right font-normal pl-2">B − A</th></tr>
        <tr v-for="r of result.stats" :key="r.stat">
          <td class="pr-3 text-gray-300">{{ r.label }}</td>
          <td class="px-2 text-right" :class="r.better === 'a' ? 'text-green-300' : 'text-gray-300'">{{ fmtStat(r.a, r.pct) }}</td>
          <td class="px-2 text-right" :class="r.better === 'b' ? 'text-green-300' : 'text-gray-300'">{{ fmtStat(r.b, r.pct) }}</td>
          <td class="pl-2 text-right" :class="r.diff == null || !r.better ? 'text-gray-500' : r.better === 'b' ? 'text-green-300' : 'text-red-300'">
            {{ r.diff == null ? '' : (r.diff > 0 ? '+' : '') + fmtStat(r.diff, r.pct) }}</td>
        </tr>
        <tr v-if="!result.stats.length"><td colspan="4" class="text-gray-500">No saved stats: open and save both builds in Path of Building once.</td></tr>
      </table>

      <div v-else-if="sec === 'gear'" class="text-xs space-y-1">
        <label class="flex items-center gap-x-1 text-gray-500"><input v-model="gearAll" type="checkbox">Show slots that are the same</label>
        <div v-for="g of result.gear.filter(g => gearAll || !g.same)" :key="g.slot" class="border-t border-gray-700 pt-1">
          <div class="text-gray-100">{{ g.slot }} <span v-if="g.same" class="text-gray-500">· same</span></div>
          <div class="text-blue-300 truncate">A: {{ g.a ?? '(empty)' }}</div>
          <div class="text-yellow-300 truncate">B: {{ g.b ?? '(empty)' }}</div>
          <div v-for="m of g.onlyA" :key="'a' + m" class="pl-2 text-red-300">− {{ m }}</div>
          <div v-for="m of g.onlyB" :key="'b' + m" class="pl-2 text-green-300">+ {{ m }}</div>
        </div>
        <div v-if="!result.gear.some(g => !g.same) && !gearAll" class="text-gray-500">Same gear in every slot.</div>
      </div>

      <div v-else-if="sec === 'gems'" class="text-xs">
        <div v-if="!result.gems.length" class="text-gray-500">Same gems and levels (enabled gems of the active skill sets).</div>
        <div v-for="g of result.gems" :key="g.change + g.name" class="flex gap-x-2">
          <span v-if="g.change === 'removed'" class="text-red-300">− {{ g.name }} <span class="text-gray-500">(A only, lvl {{ g.a }})</span></span>
          <span v-else-if="g.change === 'added'" class="text-green-300">+ {{ g.name }} <span class="text-gray-500">(B only, lvl {{ g.b }})</span></span>
          <span v-else class="text-gray-300">{{ g.name }} <span class="text-gray-500">lvl {{ g.a }} → {{ g.b }}</span></span>
        </div>
      </div>

      <div v-else class="text-xs space-y-1">
        <div class="text-gray-400">
          {{ result.tree.same }} passives in both · <span class="text-blue-300">{{ result.tree.onlyA.length }} only in A</span> · <span class="text-yellow-300">{{ result.tree.onlyB.length }} only in B</span>
          <span v-if="result.tree.masteriesChanged.length"> · {{ result.tree.masteriesChanged.length }} mastery choices differ</span>
        </div>
        <div v-if="result.tree.versionA !== result.tree.versionB" class="text-yellow-500">Different tree versions ({{ result.tree.versionA }} / {{ result.tree.versionB }}): some differences may only be renamed nodes.</div>
        <div v-for="side of (['A', 'B'] as const)" :key="side">
          <div :class="side === 'A' ? 'text-blue-300' : 'text-yellow-300'">Only in {{ side }}</div>
          <div class="pl-2 text-gray-300">
            <span v-for="n of named(side === 'A' ? result.tree.onlyA : result.tree.onlyB).big" :key="n.id" class="inline-block mr-2"
              :class="n.kind === 2 ? 'text-orange-300' : ''">{{ n.name }}</span>
            <span class="text-gray-500">{{ smallText(named(side === 'A' ? result.tree.onlyA : result.tree.onlyB)) }}</span>
          </div>
        </div>
        <div v-if="!names.size" class="text-gray-500">Passive names come from Path of Building; start it from the Tree tab once if you only see numbers.</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobBuildSummary, PobTreeMapNode } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { compareBuilds, fmtStat, type BuildCompare } from './compare'

const KEY = 'deathloom.build-compare.v1'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {} } catch { return {} } })()
const pathA = ref<string>(typeof saved.a === 'string' ? saved.a : '')
const pathB = ref<string>(typeof saved.b === 'string' ? saved.b : '')
watch([pathA, pathB], ([a, b]) => { try { localStorage.setItem(KEY, JSON.stringify({ a, b })) } catch {} })

const builds = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const sumA = shallowRef<PobBuildSummary>()
const sumB = shallowRef<PobBuildSummary>()
const result = shallowRef<BuildCompare>()
const gearAll = ref(false)
const sections = [{ id: 'stats', label: 'Stats' }, { id: 'gear', label: 'Gear' }, { id: 'gems', label: 'Gems' }, { id: 'tree', label: 'Passive tree' }] as const
const sec = ref<typeof sections[number]['id']>('stats')

let lastId = 0
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== lastId) return
  if (e.ok) { builds.value = e.list?.builds ?? []; active.value = e.list?.active ?? null } else error.value = e.error ?? 'Unknown error'
})
const lsCompare = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
  if (e.requestId !== lastId) return
  busy.value = false
  if (!e.ok || !e.a || !e.b) { error.value = e.error ?? 'Unknown error'; result.value = undefined; return }
  error.value = ''
  sumA.value = e.a
  sumB.value = e.b
  result.value = compareBuilds(e.a, e.b)
  if (!names.value.size) requestNames()
})

// passive names from the tree map layout (the active build's tree version)
const names = shallowRef(new Map<number, PobTreeMapNode>())
let namesId = 0
const lsTree = Host.onEvent('MAIN->CLIENT::pob-tree-map', (e) => {
  if (e.requestId !== namesId || !e.ok || !e.layout) return
  names.value = new Map(e.layout.nodes.map(n => [n[0], n]))
})
function requestNames () {
  namesId = (Date.now() & 0x3fffffff) | 1
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-tree-map', payload: { requestId: namesId } })
}
onUnmounted(() => { lsBuilds.abort(); lsCompare.abort(); lsTree.abort(); lsManage.abort() })

function next () { lastId = (lastId + 1000) | 0; return lastId }
Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: next() } })

// your character's copy of the active build: "<build> (my character).xml"
const active = ref<string | null>(null)
const MINE = ' (my character)'
const minePath = computed(() => {
  const a = active.value ?? ''
  return a.toLowerCase().endsWith(MINE.toLowerCase() + '.xml') ? a : a.replace(/\.xml$/i, `${MINE}.xml`)
})
const planPath = computed(() => {
  const a = active.value ?? ''
  const plan = a.replace(new RegExp(`${MINE.replace(/[()]/g, '\\$&')}\\.xml$`, 'i'), '.xml')
  return builds.value.includes(plan) ? plan : a
})
const mineExists = computed(() => builds.value.some(b => b.toLowerCase() === minePath.value.toLowerCase()))
let manageId = 0
const lsManage = Host.onEvent('MAIN->CLIENT::pob-manage-build', (e) => {
  if (e.requestId !== manageId) return
  busy.value = false
  if (!e.ok) { error.value = e.error ?? 'Unknown error'; return }
  if (e.list) builds.value = e.list.builds
  openPob()
})
function makeMine () {
  if (!active.value) return
  busy.value = true
  error.value = ''
  manageId = next()
  const name = minePath.value.split(/[\\/]/).pop()!.replace(/\.xml$/i, '')
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-manage-build', payload: { requestId: manageId, op: 'duplicate', path: active.value, name } })
}
function openPob () {
  Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-pob' } })
}
function compareMine () {
  pathA.value = planPath.value
  pathB.value = minePath.value
  sec.value = 'gear'
  run()
}

function run () {
  busy.value = true
  error.value = ''
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: next(), a: pathA.value, b: pathB.value } })
}

const label = (p: string) => p.replace(/\.xml$/i, '').replace(/\\/g, '/')
function who (s: PobBuildSummary) {
  return [s.ascendancy ?? s.className, s.level ? `lvl ${s.level}` : '', s.mainSkill].filter(Boolean).join(' · ')
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
function smallText (n: Named) {
  return [n.small ? `+ ${n.small} small passives` : '', n.unknown ? `${n.unknown} not on this tree version` : ''].filter(Boolean).join(' · ')
}
</script>
