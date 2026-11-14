<template>
  <!-- Deathloom fork: Help, FAQ and where to get a build (Loot Goblin window → Help;
       the overlay's ? links here). Keep it in step with the features. -->
  <div class="h-full min-h-0 overflow-y-auto rounded bg-gray-800 text-sm leading-snug">
    <div class="max-w-4xl mx-auto p-4 space-y-5">
      <div class="flex items-center gap-x-3">
        <div class="text-xl text-gray-100"><i class="fas fa-coins text-yellow-500 mr-2" />Loot Goblin help</div>
        <span class="text-gray-500 text-xs">{{ version }}</span>
        <div class="ml-auto flex gap-x-1">
          <button v-for="s of SECTIONS" :key="s.id" class="px-2 rounded text-xs"
            :class="section === s.id ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700'" @click="section = s.id">{{ s.label }}</button>
        </div>
      </div>

      <!-- ===== How to use it ===== -->
      <template v-if="section === 'use'">
        <section>
          <h2>Hotkeys</h2>
          <table class="text-gray-300">
            <tr v-for="k of keys" :key="k.label"><td class="pr-4 py-0.5 text-yellow-200 whitespace-nowrap">{{ k.key || 'no hotkey' }}</td><td>{{ k.label }}</td></tr>
          </table>
          <p class="hint">Change them in Settings → Price check / Path of Building.</p>
        </section>

        <section>
          <h2>The Loot Goblin window</h2>
          <p>A normal window for your second screen with everything in one place. Open it from the tray (double-click), or let it open when the game starts (Settings → Path of Building).</p>
          <ul>
            <li><b>All</b>: build, levelling, tree map, atlas tree, trades and market history at once. Drag the lines between panels to resize; double-click a line to even those panels out. <b>Edit layout</b> (top right) lets you move panels (drag them by their bar; drop on a column's edge for a new column), take them off with ×, add more (This session, market overview, market search, friends' board) and Reset layout.</li>
            <li><b>Build</b>: gear, gems, tree and Tree map of the active build.
              <i class="fas fa-exchange-alt" /> picks the build and loadout, <i class="fas fa-pen" /> edits loadouts, <i class="fas fa-folder-open" /> manages builds,
              <i class="fas fa-file-import" /> imports a PoB code or link, <i class="fas fa-cloud" /> shares builds.</li>
            <li><b>Levelling</b>: campaign guide, quest gems to take or buy, gem swaps per level and the next passives to take.</li>
            <li><b>Atlas</b>: the atlas passive tree. <i class="fas fa-file-import" /> adds an atlas build from a pathofexile.com atlas tree link or code
              (poeplanner links use their own format), the drop-down picks one, <i class="fas fa-link" /> copies its link to share with friends.
              Green = taken, orange = still to take. Loot Goblin ticks atlas passives as you allocate them in game; it can't see what you took
              before, so use <i class="fas fa-check-double" /> → "I have this whole build" (or "I have nothing" after a respec or in a new league).
              <b>Edit</b>: click a passive to take it with the path to it, or refund it with what hangs off it; notables with a choice let you pick the effect.
              Atlas builds are kept on this PC. Also on the All tab (Edit layout → Add panel → Atlas tree).</li>
            <li><b>Trades</b>: incoming and outgoing trade whispers and your ledger.</li>
            <li><b>Board</b>: the friends' trade board, only for your group (POE-Builds members, GitHub sign-in).
              <b>Give</b>: free items, press <b>Claim</b> and the poster invites you. <b>Sell</b>: priced items for friends first, press <b>Whisper</b>.
              <b>Wanted</b>: what someone needs, press <b>I have one</b> and whisper them. <b>Post</b> adds your own: paste the item text (Ctrl+C on the item in game)
              or type a name. Mark yours <b>Sold</b> / <b>Given</b> / <b>Got it</b> when done. Also in the overlay menu (<i class="fas fa-people-carry" />)
              and on the All tab (Edit layout → Add panel).</li>
            <li><b>Market</b>: your watchlist and a poe.ninja market overview.</li>
            <li><b>Trade site</b>: GGG's official trade site. Sign in on GGG's own page; Loot Goblin never sees your login.</li>
            <li><b>Settings</b>: all settings (the same as Shift+Space → Settings), the setup guide and What's new.</li>
          </ul>
        </section>

        <section>
          <h2>In game</h2>
          <ul>
            <li><b>Price check</b>: hover an item and press the price check key. You see prices and what the item does to your PoB build.</li>
            <li><b>Market search</b> (overlay menu, <i class="fas fa-search-dollar" />, or its hotkey from Settings → Path of Building): type an item name, pick it, and see who sells it, cheapest first.
              <b>Whisper</b> uses GGG's own buy message, <b>Hideout</b> is <code>/hideout name</code> (works when the seller lets visitors in).
              Instant buyout listings open in the Trade site tab, where you click GGG's "Travel to Hideout".</li>
            <li><b>Panels over the game</b>: pin the build, guide or trade companion (Settings → Path of Building → Where panels show).
              Drag them by the top bar, resize from the bottom-right corner.</li>
            <li><b>Post to the friends' board</b>: set a hotkey in Settings → Path of Building, hover an item and press it. The board opens in the overlay with the item filled in.</li>
            <li><b>Chat buttons</b> (trade companion, market search, friends' board) copy the command, or send one chat message per click (setting). Nothing is ever sent by itself.</li>
          </ul>
        </section>

        <section>
          <h2>Your build</h2>
          <ul>
            <li>Loot Goblin uses your Path of Building build: keep it up to date in PoB (re-import your character, save) and the panels follow.</li>
            <li><b>Loadouts</b>: name PoB trees after a level ("Level 12", "Level 30") and the levelling planner uses them as steps. <i class="fas fa-pen" /> → New loadout copies the picked one.</li>
            <li><b>Edit loadouts</b> (window, Build tab → <i class="fas fa-pen" />): rename / copy / delete trees, item sets and skill sets; change gem level, quality and on/off.
              Tree map → <b>Edit</b>: click a passive to take or refund it. The old file is kept in <i>Build backups</i> next to your builds folder.</li>
            <li><b>Manage builds</b> (<i class="fas fa-folder-open" />): rename, move to a folder, duplicate, delete. Deleted builds go to <i>Deleted builds</i> next to your builds folder.</li>
            <li><b>Sharing</b> (<i class="fas fa-cloud" />): sign in with GitHub, then builds sync by themselves (deletions too). Nobody sees your builds until you let them.</li>
          </ul>
        </section>

        <section>
          <h2>Campaign guide</h2>
          <ul>
            <li>Moves on by itself when you enter the next zone on the route (from the game's log file). The arrows fix it by hand.</li>
            <li>Hand-ins show what to pick for your build ("take …") and what to buy after. <span class="tag">optional</span> quests can be hidden with <i class="fas fa-plus-square" />.</li>
            <li>Bandit choice comes from your PoB build's Configuration tab.</li>
          </ul>
        </section>
      </template>

      <!-- ===== Get a build ===== -->
      <template v-else-if="section === 'builds'">
        <section>
          <h2>No build yet? Get one</h2>
          <p>Pick a build guide, copy its Path of Building code or pobb.in link, then in Loot Goblin press <i class="fas fa-file-import" /> (Build panel) and paste it.
            It's saved in your builds folder and becomes your active build. Links open in your browser.</p>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));">
            <button v-for="s of BUILD_SITES" :key="s.url" class="site" @click="open(s.url)">
              <div class="text-gray-100"><i class="fas fa-external-link-alt mr-1 text-xs text-gray-500" />{{ s.name }}</div>
              <div class="text-xs text-gray-400">{{ s.what }}</div>
            </button>
          </div>
        </section>
        <section>
          <h2>Atlas trees</h2>
          <p>Guides for your atlas passive tree (endgame maps). An atlas tree panel in Loot Goblin is coming.</p>
          <div class="grid gap-2" style="grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));">
            <button v-for="s of ATLAS_SITES" :key="s.url" class="site" @click="open(s.url)">
              <div class="text-gray-100"><i class="fas fa-external-link-alt mr-1 text-xs text-gray-500" />{{ s.name }}</div>
              <div class="text-xs text-gray-400">{{ s.what }}</div>
            </button>
          </div>
        </section>
      </template>

      <!-- ===== FAQ ===== -->
      <template v-else>
        <section v-for="(f, i) of FAQ" :key="i">
          <h3>{{ f.q }}</h3>
          <p>{{ f.a }}</p>
        </section>
      </template>

      <div class="hint pt-2 border-t border-gray-700">
        Loot Goblin is not affiliated with or endorsed by Grinding Gear Games. Something wrong? Tray icon → Report a problem…
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EXTRA_PANELS } from '@/web/desktop/panel-defs'
import { AppConfig } from '@/web/Config'
import type { PriceCheckWidget } from '@/web/overlay/widgets'
import { Host } from '@/web/background/IPC'
import { BUILD_SITES, ATLAS_SITES } from './build-sites'

const props = defineProps<{ start?: 'use' | 'builds' | 'faq' }>()
const SECTIONS = [
  { id: 'use', label: 'How to use it' },
  { id: 'builds', label: 'Get a build' },
  { id: 'faq', label: 'FAQ' }
] as const
const section = ref<'use' | 'builds' | 'faq'>(props.start ?? 'use')

const version = computed(() => Host.version.value && !Host.version.value.startsWith('0.0.0') ? `version ${Host.version.value}` : '')

const keys = computed(() => {
  const cfg = AppConfig()
  const pob = cfg.pob
  const pc = AppConfig<PriceCheckWidget>('price-check')
  return [
    { key: cfg.overlayKey, label: 'Open / close the overlay (Esc closes it too)' },
    { key: pc?.hotkey ? `${pc.hotkeyHold} + ${pc.hotkey}` : '', label: 'Price check the item under the mouse' },
    { key: pob?.gearPanelKey, label: 'Build panel' },
    { key: pob?.guideKey, label: 'Campaign guide' },
    { key: pob?.tradesKey, label: 'Trade companion' },
    { key: pob?.openPobKey, label: 'Open Path of Building' },
    // panels added in 1.0.63: no hotkey until the player sets one
    ...EXTRA_PANELS.map(p => ({ key: pob?.panelKeys?.[p.panel] ?? '', label: p.label }))
  ]
})

function open (url: string) {
  window.open(url)
}

const FAQ = [
  { q: 'Can I get banned for using Loot Goblin?', a: 'Loot Goblin is built to stay inside GGG\'s rules for third-party tools: it reads the game\'s log file (Client.txt) and your clipboard, never game memory or game files, never buys or trades by itself, and sends at most one chat command per click. It doesn\'t read your pathofexile.com login. Features that needed a login or unofficial character data (stash tracker, live character comparison) were removed.' },
  { q: 'Do I need a GitHub account?', a: 'No. Everything works without one. A GitHub account (invited to POE-Builds) is only needed to share builds with the group and send automatic problem reports.' },
  { q: 'Who can see my builds?', a: 'Nobody, until you let them. Each player has their own private builds repo; others see yours only after they ask and you approve.' },
  { q: 'Where are my builds and backups?', a: 'Documents\\Loot Goblin\\Builds (your player folder inside it). Next to it: "Deleted builds" (builds you or a friend deleted) and "Build backups" (the file as it was before an edit in Loot Goblin).' },
  { q: 'I deleted a build by mistake.', a: 'Copy it back from "Deleted builds" next to your builds folder into your player folder. Sync uploads it again.' },
  { q: 'The campaign guide is on the wrong step.', a: 'Use the arrows at the top of the guide. It also catches up by itself when you enter a zone further along the route. "Rebuild from game log" (Levelling tab) re-reads your whole log.' },
  { q: 'The price check shows no build impact.', a: 'Check Settings → Path of Building: build impact on, and a build picked in the Build panel. The first check after starting can take a few seconds while Path of Building loads.' },
  { q: 'The Whisper / Hideout button did nothing in game.', a: 'With Chat buttons set to "copy", the command is on your clipboard: press Enter in game, Ctrl+V, Enter. Set it to "send" to have one chat message sent per click.' },
  { q: 'Why does Hideout not take me to the seller?', a: '/hideout name only works when the seller lets visitors in. Most sellers invite you to their party after your whisper. Instant buyout listings use GGG\'s own Travel to Hideout button on the trade site (Trade site tab).' },
  { q: 'Who sees what I post on the friends\' board?', a: 'Only members of the POE-Builds GitHub organisation (your group). Each listing is a GitHub issue in the group\'s private repo, posted with your own GitHub sign-in, so it always shows who posted it. Only you can mark your listing done or remove it.' },
  { q: 'Do I have to sign in to the trade site?', a: 'Only for things that need your account on GGG\'s site, like Travel to Hideout for instant buyout. You sign in on GGG\'s own page inside the Trade site tab; it stays signed in and Loot Goblin never sees the login.' },
  { q: 'The game crashes with panels over it.', a: 'Set the game\'s Display mode to Windowed Fullscreen, and try Solid background (Settings → Path of Building → Show while playing). A crash on PoE 3.30 with Vulkan was fixed by switching the game\'s renderer to DirectX 12.' },
  { q: 'How do updates work?', a: 'Loot Goblin downloads updates by itself and installs them when the game isn\'t running (or click Install now in the window). Path of Building updates itself at the next start. After an update, What\'s new shows what changed.' },
  { q: 'How do I start over?', a: 'Settings → Run setup guide. The campaign guide\'s ↺ button starts the route again for a new character.' }
]
</script>

<style scoped>
h2 { @apply text-base text-gray-100 mb-1; }
h3 { @apply text-gray-100 font-bold mb-0.5; }
p { @apply text-gray-300 mb-1; }
ul { @apply list-disc pl-5 space-y-0.5 text-gray-300; }
.hint { @apply text-xs text-gray-500; }
.tag { @apply px-1 rounded bg-indigo-900 text-indigo-200 text-xs; }
.site { @apply text-left p-2 rounded bg-gray-900 hover:bg-gray-700; }
</style>
