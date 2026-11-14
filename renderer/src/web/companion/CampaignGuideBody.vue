<template>
  <!-- Deathloom fork: campaign guide body (used by the overlay widget and the HUD window) -->
  <div class="widget-default-style text-gray-200 leading-tight text-sm flex flex-col"
    :style="tall ? { width: 'var(--hud-w, 20rem)', height: 'var(--hud-h)' } : { width: 'var(--hud-w, 20rem)' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t">
      <span class="text-gray-500"><i class="fas fa-route mr-1" />Act {{ step.act }}</span>
      <span v-if="areaLevel" class="text-gray-500 text-xs">area level {{ areaLevel }}</span>
      <div class="ml-auto flex gap-x-2 text-gray-500">
        <button class="hover:text-gray-200" title="Previous step" @click="move(-1)"><i class="fas fa-chevron-left" /></button>
        <button class="hover:text-gray-200" title="Next step" @click="move(1)"><i class="fas fa-chevron-right" /></button>
        <button class="hover:text-gray-200" :title="showAll ? 'Show fewer steps' : 'Show the whole act'" @click="showAll = !showAll">
          <i class="fas" :class="showAll ? 'fa-compress-alt' : 'fa-list'" /></button>
        <button class="hover:text-gray-200" title="Start over (new character)" @click="reset"><i class="fas fa-undo" /></button>
      </div>
    </div>
    <div ref="listEl" class="p-1 min-h-0" :class="{ 'overflow-y-auto flex-1': tall }">
      <div v-for="s of visible" :key="s.i" class="flex gap-x-2 px-1 rounded" :data-current="s.i === index ? '1' : undefined"
        :class="s.i === index ? 'bg-gray-800' : (s.i < index ? 'opacity-50' : '')">
        <span class="w-4 shrink-0 text-center">
          <i v-if="s.i === index" class="fas fa-map-marker-alt text-green-400" />
          <i v-else-if="s.via === 'waypoint'" class="fas fa-dungeon text-blue-400 text-xs" title="Waypoint" />
          <i v-else-if="s.via === 'logout'" class="fas fa-sign-out-alt text-gray-500 text-xs" title="Log out (back to town)" />
        </span>
        <div class="min-w-0 flex-1">
          <div :class="s.i === index ? 'text-gray-100' : 'text-gray-400'">
            <span v-if="s.via === 'waypoint'" class="text-xs text-blue-400">Waypoint → </span>
            <span v-else-if="s.via === 'logout'" class="text-xs text-gray-500">Log out → </span>{{ s.zone }}
            <span v-if="s.tasks.length && !showTasks(s.i)" class="text-xs text-gray-600"> · {{ s.tasks.length }} to do</span>
          </div>
          <template v-if="showTasks(s.i)">
            <div v-for="(t, ti) of s.tasks" :key="ti" class="text-xs pl-1" :class="s.i === index ? 'text-gray-300' : 'text-gray-500'">
              <template v-for="(p, pi) of t.parts" :key="pi">
                <template v-if="typeof p === 'string'">{{ p }}</template>
                <template v-else-if="p.k === 'quest'">
                  <span class="text-yellow-200" :class="{ 'line-through opacity-60': doneQuests.has(String(p.v)) }">{{ p.v }}</span>
                  <i v-if="doneQuests.has(String(p.v))" class="fas fa-check text-green-500 ml-1" title="Reward received (game log)" />
                  <span v-if="p.passive" class="ml-1 px-1 rounded bg-yellow-900 text-yellow-300"
                    :title="`${p.v}: ${p.passive} passive skill point${p.passive > 1 ? 's' : ''}${p.respec ? ` + ${p.respec} respec points` : ''}`">+{{ p.passive }} passive</span>
                  <span v-else-if="p.respec" class="ml-1 px-1 rounded bg-gray-700 text-gray-400"
                    :title="`${p.v}: ${p.respec} respec points only. Skippable (Orbs of Regret do the same).`">respec · skippable</span>
                  <template v-if="gemFor(p.offer)">
                    <span v-if="gemFor(p.offer)!.take" class="ml-1 px-1 rounded bg-gray-700 text-green-300"
                      :title="`Quest reward for your build: pick ${gemFor(p.offer)!.take!.name}`"><i class="fas fa-gem mr-1" />take {{ gemFor(p.offer)!.take!.name }}</span>
                    <span v-if="gemFor(p.offer)!.buy.length" class="ml-1 px-1 rounded bg-gray-700 text-gray-300"
                      :title="`Then buy from ${gemFor(p.offer)!.buy[0].vendor}`"><i class="fas fa-coins mr-1" />buy {{ gemFor(p.offer)!.buy.map(g => g.name).join(', ') }}</span>
                  </template>
                </template>
                <span v-else-if="p.k === 'kill'" class="text-red-300" :class="{ 'line-through opacity-60': doneBosses.has(String(p.v)) }">{{ p.v }}<i
                  v-if="doneBosses.has(String(p.v))" class="fas fa-check text-green-500 ml-1" title="Boss met (game log)" /></span>
                <span v-else-if="p.k === 'arena'" class="text-red-200">{{ p.v }}</span>
                <span v-else-if="p.k === 'area'" class="text-blue-200">{{ p.v }}</span>
                <span v-else-if="p.k === 'waypoint'" class="text-blue-300"><i class="fas fa-dungeon" /> {{ p.v ?? 'waypoint' }}</span>
                <span v-else-if="p.k === 'waypoint_get'" class="text-blue-300">waypoint</span>
                <span v-else-if="p.k === 'trial'" class="text-yellow-500"><i class="fas fa-dungeon" /> the Labyrinth trial</span>
                <span v-else-if="p.k === 'logout'" class="text-gray-400">log out</span>
                <i v-else-if="p.k === 'dir'" class="fas fa-arrow-up text-gray-300 mx-px" :style="{ transform: `rotate(${Number(p.v)}deg)` }" :title="`direction ${p.v}°`" />
                <span v-else-if="p.k === 'portal'" class="text-purple-300">{{ p.v === 'set' ? 'a portal' : 'the portal' }}</span>
                <span v-else-if="p.k === 'ascend'" class="text-yellow-400">Ascend ({{ p.v }} Labyrinth)</span>
                <span v-else-if="p.k === 'crafting'" class="text-gray-400">crafting recipe</span>
                <span v-else class="text-gray-100">{{ p.v }}</span>
              </template>
              <div v-for="(sub, si) of (s.i === index ? t.subs ?? [] : [])" :key="si" class="pl-3 text-gray-500">
                <template v-for="(p, pi) of sub" :key="pi">
                  <template v-if="typeof p === 'string'">{{ p }}</template>
                  <i v-else-if="p.k === 'dir'" class="fas fa-arrow-up mx-px" :style="{ transform: `rotate(${Number(p.v)}deg)` }" />
                  <span v-else class="text-gray-300">{{ p.v ?? p.k }}</span>
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>
      <div class="px-1 pt-1 text-xs text-gray-600" :title="'Quest passive points on the route: ' + QUEST_PASSIVES + ' (one of them for killing all three bandits). In game, /passives lists the ones you have.'">
        <span class="px-1 rounded bg-yellow-900 text-yellow-300">+1 passive</span> quest skill point:
        {{ passivesSoFar }} so far, {{ QUEST_PASSIVES - passivesSoFar }} to go
      </div>
      <div v-if="!lastZone" class="px-1 pt-1 text-xs text-gray-600">
        Follows you on each zone change (from Client.txt). If it doesn't move after you change zones,
        set the Client.txt path in Settings → General.
      </div>
      <div v-if="lastZone && !matched" class="px-1 pt-1 text-xs text-gray-600">
        In "{{ lastZone }}" (not on the route)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from './game-log'
import { STEPS, findStep, isOnRoute, actFromAreaCode, QUEST_PASSIVES, CAMPAIGN_STEP_KEY as KEY, loadCampaignStep as loadIndex, questPassivesBefore } from './campaign-route'
import { planQuestGems, type QuestGemStep } from './quest-gems'
import { currentPlan } from '../pob/plan-store'
import { CHAR_LEVELS_KEY, currentChar, loadCharLevels, progressOf } from './char-level'

const index = ref(loadIndex())
// Deathloom fork: overlay, HUD and desktop window each show the guide; keep them on the same step
const onStorage = (e: StorageEvent) => { if (e.key === KEY) index.value = loadIndex() }
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })
const showAll = ref(false)
const lastZone = ref('')
const matched = ref(true)
const areaLevel = ref<number | null>(null)
// act of the zone being entered, from its area id (null = unknown)
let areaAct: number | null = null

function setIndex (i: number) {
  index.value = Math.min(STEPS.length - 1, Math.max(0, i))
  try { localStorage.setItem(KEY, String(index.value)) } catch {}
}

const step = computed(() => STEPS[index.value])

// tall: resized in the HUD; shows the whole act and scrolls to the current step
const props = defineProps<{ tall?: boolean }>()
const listEl = ref<HTMLElement>()

// quest passive points from the steps already passed (the guide doesn't know
// which side quests you actually did; it's a reminder, /passives in game is exact)
const passivesSoFar = computed(() => questPassivesBefore(index.value))

// quests whose reward arrived and bosses met (game log, recorded by the overlay)
const levels = ref(loadCharLevels())
const onLevels = (e: StorageEvent) => { if (e.key === CHAR_LEVELS_KEY) levels.value = loadCharLevels() }
window.addEventListener('storage', onLevels)
onUnmounted(() => { window.removeEventListener('storage', onLevels) })
const progress = computed(() => progressOf(levels.value, currentChar(levels.value)?.name ?? ''))
const doneQuests = computed(() => new Set(progress.value?.quests ?? []))
const doneBosses = computed(() => new Set(progress.value?.bosses ?? []))

// tasks of the current and the next two steps (all with "show the whole act")
function showTasks (i: number) {
  return showAll.value || (i >= index.value && i <= index.value + 2)
}

// which quest reward / vendor gems the build wants (Loot Goblin window, where the
// levelling planner has the build's gems)
const questGems = computed(() => {
  const p = currentPlan.value
  if (!p) return new Map<string, QuestGemStep>()
  const plan = planQuestGems(p.className, [...(p.previousGems ?? []), ...p.gems, ...(p.nextGems ?? [])])
  return new Map((plan?.steps ?? []).map(st => [st.id, st]))
})
function gemFor (offer: string | undefined) {
  return offer ? questGems.value.get(offer) : undefined
}

const visible = computed(() => {
  const all = STEPS.map((s, i) => ({ ...s, i }))
  if (showAll.value || props.tall) return all.filter(s => s.act === step.value.act)
  return all.slice(Math.max(0, index.value - 1), index.value + 5)
})

watch([index, () => props.tall], () => {
  if (!props.tall) return
  nextTick(() => {
    listEl.value?.querySelector('[data-current]')?.scrollIntoView({ block: 'center' })
  }).catch(() => {})
}, { immediate: true })

function move (d: number) { setIndex(index.value + d) }
function reset () { setIndex(0); lastZone.value = ''; matched.value = true }

const listener = Host.onEvent('MAIN->CLIENT::game-log', (e) => {
  const lang = AppConfig().language
  for (const line of e.lines) {
    const ev = parseLogLine(line, lang)
    if (!ev) continue
    if (ev.type === 'area') {
      areaLevel.value = ev.level
      areaAct = actFromAreaCode(ev.code)
    }
    if (ev.type === 'zone') {
      lastZone.value = ev.name
      // forward only: back in town or an earlier zone keeps the current step
      const i = findStep(ev.name, index.value, areaAct)
      matched.value = isOnRoute(ev.name)
      if (i >= 0) setIndex(i)
    }
  }
})
onUnmounted(() => { listener.abort() })
</script>
