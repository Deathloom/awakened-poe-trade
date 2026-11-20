<template>
  <!-- Deathloom fork (idea 6): compare two builds of the player folder (stats,
       gear, gems, passive tree). Read from the build files; nothing is changed. -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1 max-h-[32rem] overflow-y-auto">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-gray-400">Compare builds</span>
      <select v-model="pathA" class="bg-gray-900 rounded px-1 max-w-[14rem] border-l-2 border-blue-400" title="Left build (blue): what you compare from, e.g. your character">
        <option value="">Left build…</option>
        <option v-for="p of builds" :key="p" :value="p">{{ label(p) }}</option>
      </select>
      <span class="text-gray-500">vs</span>
      <select v-model="pathB" class="bg-gray-900 rounded px-1 max-w-[14rem] border-l-2 border-yellow-400" title="Right build (yellow): what you compare to, e.g. the build you follow">
        <option value="">Right build…</option>
        <option v-for="p of builds" :key="p" :value="p">{{ label(p) }}</option>
      </select>
      <button class="ui-btn ui-btn-quiet" title="Swap left and right" @click="[pathA, pathB] = [pathB, pathA]"><i class="fas fa-exchange-alt" /></button>
      <button class="px-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-50" :disabled="busy || !pathA || !pathB || pathA === pathB" @click="run">
        <i v-if="busy" class="fas fa-spinner fa-spin mr-1" />Compare</button>
    </div>
    <!-- Deathloom fork (Gerhard 17 Nov 2026): your character's gear vs this build.
         Path of Building does the import (you click Import in PoB); Orbhoarder only
         reads the saved build file, so it stays within GGG's rules. -->
    <div v-if="active" class="rounded bg-gray-900 px-2 py-1 text-xs text-gray-400">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="text-gray-200"><i class="fas fa-user-check mr-1" />Your character vs this build</span>
        <button v-if="!mineExists && me.charName.value" class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:opacity-50" :disabled="busy || me.busy.value"
          :title="`Copies '${label(planPath)}' to '${label(minePath)}' in your folder`" @click="makeMine">Make {{ label(minePath) }}</button>
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" :title="`Opens Path of Building. There: open '${label(minePath)}', Import/Export Build → Import character → Items and Skills, then save.`" @click="openPob">{{ mineExists ? 'Update gear in Path of Building' : 'Open Path of Building' }}</button>
        <button v-if="mineExists" class="px-2 rounded bg-gray-600 hover:bg-gray-500 text-gray-100 disabled:opacity-50" :disabled="busy" :title="`Your character (left, blue) vs the build you follow (right, yellow), gear first. Uses what Path of Building last saved.`" @click="compareMine">Compare gear</button>
      </div>
      <div class="mt-0.5" :class="mineExists ? 'text-green-400' : 'text-yellow-500'">
        {{ mineExists ? `Set up: ${label(minePath)} holds ${me.charName.value || 'your character'}. Any build you follow compares against it.` : 'Not set up yet for this character (once per character, about 2 minutes).' }}
      </div>
      <!-- Deathloom fork (Gerhard 19 Nov 2026): the file belongs to the character, not the build -->
      <div v-if="!me.charName.value" class="mt-0.5 flex items-center gap-x-1">
        <span>Character name:</span>
        <input v-model="nameDraft" class="bg-gray-700 rounded px-1 w-36" placeholder="as in game" @keydown.enter="me.setTypedName(nameDraft)">
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 disabled:opacity-50" :disabled="!nameDraft.trim()" @click="me.setTypedName(nameDraft)">OK</button>
        <span class="text-gray-500">(the game log hasn't seen a level-up yet)</span>
      </div>
      <div v-if="!mineExists && me.resolved.value.legacy && me.charName.value" class="mt-0.5 flex items-center gap-x-2">
        <span>Found an older copy: <b class="text-gray-300">{{ label(me.resolved.value.legacy) }}</b></span>
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="me.link(me.resolved.value.legacy)">Use it</button>
      </div>
      <div v-if="me.charName.value && me.files.value.length" class="mt-0.5 flex items-center gap-x-1">
        <span>File for {{ me.charName.value }}:</span>
        <select class="bg-gray-800 rounded px-1 max-w-[16rem]" :value="me.minePath.value ?? ''" @change="me.link(($event.target as HTMLSelectElement).value || null)">
          <option value="">(none)</option>
          <option v-for="f of me.files.value" :key="f" :value="f">{{ label(f) }}</option>
        </select>
      </div>
      <div v-if="me.manageError.value" class="mt-0.5 text-red-400">{{ me.manageError.value }}</div>
      <button class="ui-btn ui-btn-quiet mt-0.5" @click="toggleSetup">
        <i class="fas" :class="setupOpen ? 'fa-caret-down' : 'fa-caret-right'" /> {{ mineExists ? 'How to update it, or set it up again' : 'How to set it up (first time)' }}</button>
      <div v-if="setupOpen" class="pl-2">
        <ol class="mt-0.5 list-decimal pl-4 space-y-0.5">
          <li><b class="text-gray-300">Make {{ label(minePath) || 'My characters/<your character>' }}</b> (button above). It copies the build you follow into the <b class="text-gray-300">My characters</b> folder and opens Path of Building. Your build itself is never changed, and renaming or updating it later is fine.</li>
          <li>In Path of Building's build list, open <b class="text-gray-300">{{ label(minePath) }}</b>. Not the original: importing replaces that build's gear.</li>
          <li>Go to the <b class="text-gray-300">Import/Export Build</b> tab. Under <b class="text-gray-300">Import From Your Account</b>, sign in with your PoE account (Path of Building opens the official page), or under <b class="text-gray-300">Import By Account Name</b> type your name with its <b class="text-gray-300">#1234</b> and click <b class="text-gray-300">Start</b> (your profile's Characters tab must be public).</li>
          <li>Pick your league and character, tick <b class="text-gray-300">Delete equipment</b> and <b class="text-gray-300">Delete skills</b>, then click <b class="text-gray-300">Items and Skills</b>. Don't click <b class="text-gray-300">Passive Tree and Jewels</b>: the build's tree stays.</li>
          <li>Save with <b class="text-gray-300">Ctrl+S</b>, come back here and click <b class="text-gray-300">Compare gear</b>. The Gems tab can use it too: <b class="text-gray-300">Equipped from → my character</b>.</li>
        </ol>
        <div class="mt-1 text-gray-400"><b class="text-gray-300">Gear changed?</b> Click <b class="text-gray-300">Update gear in Path of Building</b>, then steps 2, 4 and 5. Path of Building remembers your account, so it's a few clicks.</div>
        <div class="mt-1 text-gray-400"><b class="text-gray-300">Opening Path of Building yourself:</b> the button above, right-click the Orbhoarder tray icon → <b class="text-gray-300">Open Path of Building</b>, or set a key in Settings → Hotkeys → <b class="text-gray-300">Open Path of Building</b>. Use this one rather than another install, so it sees the same builds folder.</div>
      </div>
      <div class="mt-0.5 text-gray-500">Left (blue) = your character, right (yellow) = the build you follow. The import happens in Path of Building when you click it; Orbhoarder only reads the saved file.</div>
    </div>
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <div v-if="!error && !result" class="text-xs text-gray-500">Or pick any two builds from your folder (or a friend's, via Player): left (blue) and right (yellow). Green shows what the right one has more of. Uses what Path of Building last saved in each file.</div>
    <template v-if="result && sumA && sumB">
      <div class="text-xs text-gray-400">
        <span class="text-blue-300">{{ nameA }}</span> {{ who(sumA) }} · <span class="text-yellow-300">{{ nameB }}</span> {{ who(sumB) }}
      </div>
      <div class="flex gap-1">
        <button v-for="s of sections" :key="s.id" class="px-2 rounded text-xs"
          :class="sec === s.id ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700'" @click="sec = s.id">{{ s.label }}</button>
      </div>

      <table v-if="sec === 'stats'" class="text-xs">
        <tr class="text-gray-500"><th class="text-left font-normal pr-3">Stat</th><th class="text-right font-normal px-2 text-blue-300">{{ nameA }}</th><th class="text-right font-normal px-2 text-yellow-300">{{ nameB }}</th><th class="text-right font-normal pl-2" :title="`How much ${nameB} has more (+) or less (−) than ${nameA}`">Difference</th></tr>
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
          <div class="text-blue-300 truncate">{{ nameA }}: {{ g.a ?? '(empty)' }}</div>
          <div class="text-yellow-300 truncate">{{ nameB }}: {{ g.b ?? '(empty)' }}</div>
          <!-- Deathloom fork (19 Nov): grouped, so it's clear what you have and what's left -->
          <div v-if="g.onlyB.length" class="pl-2 mt-0.5">
            <div class="text-gray-400">{{ charMode ? 'Still need' : `Only on ${nameB}` }} <span class="text-gray-600">({{ g.onlyB.length }})</span></div>
            <div v-for="m of g.onlyB" :key="'b' + m" class="pl-2 text-yellow-200">○ {{ m }}</div>
          </div>
          <div v-if="g.aLower.length" class="pl-2 mt-0.5">
            <div class="text-gray-400">{{ charMode ? 'Have it, but lower' : `Lower on ${nameA}` }}</div>
            <div v-for="m of g.aLower" :key="'l' + m.a" class="pl-2 text-orange-300">◐ {{ m.a }} <span class="text-gray-500">→ {{ m.b }}</span></div>
          </div>
          <div v-if="g.both.length || g.aHigher.length" class="pl-2 mt-0.5">
            <div class="text-gray-400">{{ charMode ? 'Already have' : 'On both' }} <span class="text-gray-600">({{ g.both.length + g.aHigher.length }})</span></div>
            <div v-for="m of g.both" :key="'s' + m" class="pl-2 text-green-300">✓ {{ m }}</div>
            <div v-for="m of g.aHigher" :key="'h' + m.a" class="pl-2 text-green-300">✓ {{ m.a }} <span class="text-gray-500">(build: {{ m.b }})</span></div>
          </div>
          <div v-if="g.onlyA.length" class="pl-2 mt-0.5">
            <div class="text-gray-400">{{ charMode ? 'Extra on yours (not in the build)' : `Only on ${nameA}` }}</div>
            <div v-for="m of g.onlyA" :key="'a' + m" class="pl-2 text-gray-500">· {{ m }}</div>
          </div>
        </div>
        <div v-if="!result.gear.some(g => !g.same) && !gearAll" class="text-gray-500">Same gear in every slot.</div>
      </div>

      <div v-else-if="sec === 'gems'" class="text-xs">
        <div v-if="!result.gems.length" class="text-gray-500">Same gems and levels (enabled gems of the active skill sets).</div>
        <div v-for="g of result.gems" :key="g.change + g.name" class="flex gap-x-2">
          <span v-if="g.change === 'removed'" class="text-red-300">− {{ g.name }} <span class="text-gray-500">(only {{ nameA }}, lvl {{ g.a }})</span></span>
          <span v-else-if="g.change === 'added'" class="text-green-300">+ {{ g.name }} <span class="text-gray-500">(only {{ nameB }}, lvl {{ g.b }})</span></span>
          <span v-else class="text-gray-300">{{ g.name }} <span class="text-gray-500">lvl {{ g.a }} → {{ g.b }}</span></span>
        </div>
      </div>

      <div v-else class="text-xs space-y-1">
        <div class="text-gray-400">
          {{ result.tree.same }} passives in both · <span class="text-blue-300">{{ result.tree.onlyA.length }} only in {{ nameA }}</span> · <span class="text-yellow-300">{{ result.tree.onlyB.length }} only in {{ nameB }}</span>
          <span v-if="result.tree.masteriesChanged.length"> · {{ result.tree.masteriesChanged.length }} mastery choices differ</span>
        </div>
        <div v-if="result.tree.versionA !== result.tree.versionB" class="text-yellow-500">Different tree versions ({{ result.tree.versionA }} / {{ result.tree.versionB }}): some differences may only be renamed nodes.</div>
        <div v-for="side of (['A', 'B'] as const)" :key="side">
          <div :class="side === 'A' ? 'text-blue-300' : 'text-yellow-300'">Only in {{ side === 'A' ? nameA : nameB }}</div>
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
import { samePath } from './my-character'
import { useMyCharacter } from './use-my-character'

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
onUnmounted(() => { lsBuilds.abort(); lsCompare.abort(); lsTree.abort() })

function next () { lastId = (lastId + 1000) | 0; return lastId }
Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: next() } })

const active = ref<string | null>(null)
const SETUP_KEY = 'deathloom.compare-setup.v1'
const setupPref = ref<boolean | null>((() => { try { const v = localStorage.getItem(SETUP_KEY); return v == null ? null : v === '1' } catch { return null } })())
// open by default until it's set up, then closed unless you open it
const setupOpen = computed(() => setupPref.value ?? !mineExists.value)
function toggleSetup () {
  setupPref.value = !setupOpen.value
  try { localStorage.setItem(SETUP_KEY, setupPref.value ? '1' : '0') } catch {}
}
// Deathloom fork (Gerhard 19 Nov 2026): "My characters/<character>.xml", linked per character
const me = useMyCharacter()
me.refresh()
const nameDraft = ref('')
const mineExists = computed(() => !!me.minePath.value)
const minePath = computed(() => me.minePath.value ?? me.targetPath.value)
const planPath = me.planPath
function makeMine () {
  error.value = ''
  me.makeFile(() => {
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: next() } })
    openPob()
  })
}
function openPob () {
  Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-pob', build: mineExists.value ? me.minePath.value ?? undefined : undefined } })
}
function compareMine () {
  // left = your character, right = the build you follow: green + = your upgrades
  pathA.value = minePath.value
  pathB.value = planPath.value
  sec.value = 'gear'
  run()
}

const ranA = ref('')
const ranB = ref('')
function run () {
  // your character always on the left (blue), whatever order the pickers are in,
  // so green + is always what the build has that you don't (Gerhard 17 Nov)
  const isMine = (p: string) => mineExists.value && samePath(p, minePath.value)
  if (isMine(pathB.value) && !isMine(pathA.value)) [pathA.value, pathB.value] = [pathB.value, pathA.value]
  ranA.value = pathA.value
  ranB.value = pathB.value
  busy.value = true
  error.value = ''
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: next(), a: pathA.value, b: pathB.value } })
}

// names instead of A / B: "Your character", "Build you follow", or the file name
function sideName (p: string) {
  if (!p) return ''
  if (mineExists.value && samePath(p, minePath.value)) return 'Your character'
  if (mineExists.value && samePath(p, planPath.value)) return 'Build you follow'
  return label(p).split('/').pop() ?? p
}
const nameA = computed(() => sideName(ranA.value))
// your character on the left: word it as "still need" / "already have"
const charMode = computed(() => nameA.value === 'Your character')
const nameB = computed(() => sideName(ranB.value))
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
