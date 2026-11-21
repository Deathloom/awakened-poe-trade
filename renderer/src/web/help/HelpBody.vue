<template>
  <!-- Deathloom fork: Help, FAQ and where to get a build (Orbhoarder window → Help;
       the overlay's ? links here). Keep it in step with the features. -->
  <div class="h-full min-h-0 overflow-y-auto rounded bg-gray-800 text-sm leading-snug">
    <div class="max-w-4xl mx-auto p-4 space-y-5">
      <div class="flex items-center gap-x-3">
        <div class="text-xl text-gray-100"><i class="fas fa-coins text-yellow-500 mr-2" />Orbhoarder help</div>
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
          <p class="hint">Change them in Settings → Hotkeys.</p>
        </section>

        <section>
          <h2>The Orbhoarder window</h2>
          <p>A normal window for your second screen with everything in one place. Open it from the tray (double-click), or let it open when the game starts (Settings → General).</p>
          <ul>
            <li><b>All</b>: build, levelling, tree map, atlas tree, trades and market history at once. Drag the lines between panels to resize; double-click a line to even those panels out. <b>Edit layout</b> (top right) lets you move panels (drag them by their bar; drop on a column's edge for a new column), take them off with ×, add more (This session, market overview, market search, friends' board) and Reset layout.</li>
            <li><b>Build</b>: gear, gems, tree and Tree map of the active build.
              <b>Build</b> (top right) picks the build and loadout; the <b>⋯</b> menu next to it has Import a build, Build sharing, What changes between stages,
              Compare, Edit loadouts and Manage builds. In the overlay and in game, Compare / Edit / Manage open this window.</li>
            <li><b>Levelling</b>: campaign guide, quest gems to take or buy, gem swaps per level and the next passives to take.</li>
            <li><b>Atlas</b>: the atlas passive tree. The drop-down picks an atlas build; the <b>⋯</b> menu adds one from a pathofexile.com atlas tree link or code
              (poeplanner links use their own format) or makes a ready-made tree, and copies the link to share with friends, renames or deletes it.
              Green = taken, orange = still to take. Step along the build with the arrows (1 or 5 passives) as you take passives in game;
              ⋯ → "Taken: jump to all or nothing" sets "I have this whole build" (or "I have nothing" after a respec or in a new league).
              <b>Edit</b>: click a passive to take it with the path to it, or refund it with what hangs off it; notables with a choice let you pick the effect.
              <b>Stats</b> adds up everything the passives give. Ready-made tree: pick the content you farm (one or more), keep Map sustain on and set the points, then Generate: it shows on the atlas without saving, so Generate again until you like it, then Save (or Discard);
              Orbhoarder takes that content's notables by the shortest path from the start, using only GGG's own atlas data.
              Atlas builds are saved in your builds folder (Atlas) and sync with your builds, so friends who can see your builds see your atlas builds too
              (listed under their name, read-only: ⋯ → Copy to my atlas builds). Also on the All tab (Edit layout → Add panel → Atlas tree).</li>
            <li><b>Trades</b>: incoming and outgoing trade whispers and your ledger.</li>
            <li><b>Board</b>: the friends' trade board, only for your group (POE-Builds members, GitHub sign-in).
              <b>Give</b>: free items, press <b>Claim</b> and the poster invites you. <b>Sell</b>: priced items for friends first, press <b>Whisper</b>.
              <b>Wanted</b>: what someone needs, press <b>I have one</b> and whisper them. <b>Post</b> adds your own: paste the item text (Ctrl+C on the item in game)
              or type a name. Mark yours <b>Sold</b> / <b>Given</b> / <b>Got it</b> when done. Also in the overlay menu (<i class="fas fa-people-carry" />)
              and on the All tab (Edit layout → Add panel).</li>
            <li><b>Market</b>: your watchlist and a poe.ninja market overview, plus tools (tabs on the left):
              <b>Shopping</b> (what your build still needs: its uniques and gems at the cheapest poe.ninja price; tick what you have, every row has Trade and gear rows ↑ to open the trade site; click a gear row for its mods; rares are listed without a price),
              <b>Sell list</b> (what you plan to sell: value now, a week of prices, "Falling: sell soon" or "Rising: can wait", and a copy button for a <code>~price</code> note),
              <b>Farming</b> (name what you're farming at the top; maps with loot added in This session then show profit per map and per hour, by strategy or by league mechanic),
              <b>Crafting</b> (crafting currency prices with a week's trend, and a sum of what your craft costs).
              The <b>1 div = … c</b> button in the Market bar shows the divine price trend, a chaos ↔ divine converter and your wallet (from Money tools → Currency counter).</li>
            <li><b>Trade site</b>: GGG's official trade site. Sign in on GGG's own page; Orbhoarder never sees your login.</li>
            <li><b>Settings</b>: all settings (the same as Shift+Space → Settings), the setup guide, What's new and <b>Patch notes</b> (GGG's PC patch notes; a yellow dot means new notes came out since you last opened them, with a Windows notification too: Settings → General to turn it off).</li>
          </ul>
        </section>

        <section>
          <h2>In game</h2>
          <ul>
            <li><b>Price check</b>: hover an item and press the price check key. You see prices and what the item does to your PoB build.</li>
            <li><b>Map check</b>: hover a map and press the item check key. Mods you coloured (Settings → Maps) and the ones in your build's Notes show as always.
              With a PoB build active, mods dangerous for it get a red edge and <i class="fas fa-hammer" /> (hover for why: reflect for melee, no regen for regen builds, less max res when your over-cap is low, curses unless you're curse immune, …)
              and mods that are fine for it (or have no build-specific rule) are greyed; mods dangerous for every build (more monster damage or crit, penetration, poison on hit, …) never are. It uses the stats PoB saved in the build file, so save the build in PoB after big changes. <b>?</b> on the map check shows the legend; Settings → Maps → Warn for my PoB build turns it off.</li>
            <li><b>Market search</b> (overlay menu, <i class="fas fa-search-dollar" />, or its hotkey from Settings → Hotkeys): type an item name, pick it, and see who sells it, cheapest first.
              <b>Whisper</b> uses GGG's own buy message, <b>Hideout</b> is <code>/hideout name</code> (works when the seller lets visitors in).
              Instant buyout listings open in the Trade site tab, where you click GGG's "Travel to Hideout".</li>
            <li><b>Panels over the game</b>: pin any panel (build, guide, trade companion, tree map, atlas, session, market, cheat sheets, money) with Settings → Panels → Where panels show.
              Drag them by the top bar, resize from the bottom-right corner. A panel set to click-through can't be dragged while you play: press Shift+Space first.</li>
            <li><b>Panels in the overlay</b>: hover a panel, click <b>Move</b> and drag one of the corner squares. A panel's hotkey pressed in game shows only that panel; Shift+Space shows the menu and every open panel.</li>
            <li><b>Cheat sheets</b>: short sheets for league mechanics (Covens, Betrayal, Heist, Delve, Sanctum, map mechanics), vendor recipes and a league checklist.
              <b>Fate reward values</b> (button at the bottom of the Covens sheet): the Fate reward types with their poe.ninja price per item, dearest first, and how many copies of a Fate pay
              (2 for the single Divine / Annulment outcomes, otherwise 1 or 3). GGG doesn't say how many items most rewards give, so the star only means "highest price per item"; random drops have no price.
              <b>Thread planner</b>: pick a Thread and how many you put in the map device (1–8) to see the guaranteed Thread mods, which 3 / 6 / 8 bonus you get and the next one,
              the area level the strongest effects need, the cost per map at poe.ninja prices (chaos and divine) and the atlas notables that help that Thread
              (which option to choose on Dextral / Sinistral Threads, which type to rule out on Threadbare / Unthreaded). <b>?</b> says where the numbers come from.
              <b>Challenges</b>: this league's 40 challenges with their steps, a tip and a link to the cheat sheet that helps. Tick them yourself (the app doesn't read your account):
              saved on this PC for the league picked in Settings, so a new league starts empty; Hardcore and SSF share the list, Ruthless has its own. <b>⋯</b> unticks them all.</li>
            <li><b>Post to the friends' board</b>: set a hotkey in Settings → Hotkeys, hover an item and press it. The board opens in the overlay with the item filled in.</li>
            <li><b>Chat buttons</b> (trade companion, market search, friends' board) copy the command, or send one chat message per click (setting). Nothing is ever sent by itself.</li>
          </ul>
        </section>

        <section>
          <h2>Your build</h2>
          <ul>
            <li>Orbhoarder uses your Path of Building build: keep it up to date in PoB (re-import your character, save) and the panels follow.</li>
            <li><b>Loadouts</b>: name PoB trees after a level ("Level 12", "Level 30") and the levelling planner uses them as steps. ⋯ → Edit loadouts and gems → New loadout copies the picked one.</li>
            <li><b>Edit loadouts</b> (window, Build tab → ⋯ → Edit loadouts and gems): rename / copy / delete trees, item sets and skill sets; change gem level, quality and on/off.
              Tree map → <b>Edit</b>: click a passive to take or refund it. The old file is kept in <i>Build backups</i> next to your builds folder.</li>
            <li><b>Manage builds</b> (window, Build tab → ⋯ → Manage builds): rename, move to a folder, duplicate, delete. Deleted builds go to <i>Deleted builds</i> next to your builds folder.</li>
            <li><b>Sharing</b> (Build panel → ⋯ → Build sharing): sign in with GitHub, then builds sync by themselves (deletions too). Nobody sees your builds until you let them.</li>
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
          <p>Pick a build guide, copy its Path of Building code or pobb.in link, then in Orbhoarder open Build panel → ⋯ → Import a build and paste it.
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
          <p>Guides for your atlas passive tree (endgame maps). Paste a guide's pathofexile.com atlas link in the Atlas tab, or make a ready-made tree there.</p>
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
        Orbhoarder is not affiliated with or endorsed by Grinding Gear Games. Something wrong? Tray icon → Report a problem…
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
  { q: 'Can I get banned for using Orbhoarder?', a: 'Orbhoarder is built to stay inside GGG\'s rules for third-party tools: it reads the game\'s log file (Client.txt) and your clipboard, never game memory or game files, never buys or trades by itself, and sends at most one chat command per click. It doesn\'t read your pathofexile.com login. Features that needed a login or unofficial character data (stash tracker, live character comparison) were removed; to compare your character, Path of Building imports it when you click Import there.' },
  { q: 'Do I need a GitHub account?', a: 'No. Everything works without one. A GitHub account (invited to POE-Builds) is only needed to share builds with the group and send automatic problem reports.' },
  { q: 'Who can see my builds?', a: 'Nobody, until you let them. Each player has their own private builds repo; others see yours only after they ask and you approve.' },
  { q: 'Where are my builds and backups?', a: 'Documents\\Loot Goblin\\Builds (your player folder inside it; the folder kept the app\'s old name). Next to it: "Deleted builds" (builds you or a friend deleted) and "Build backups" (the file as it was before an edit in Loot Goblin).' },
  { q: 'I deleted a build by mistake.', a: 'Copy it back from "Deleted builds" next to your builds folder into your player folder. Sync uploads it again.' },
  { q: 'The campaign guide is on the wrong step.', a: 'Use the arrows at the top of the guide. It also catches up by itself when you enter a zone further along the route. "Rebuild from game log" (Levelling tab) re-reads your whole log.' },
  { q: 'How do I compare my character\'s gear with my build?', a: 'Build → Gear → ⚖ Compare → "Your character vs this build". Make your character\'s file ("My characters/<character name>", once per character, not per build), and in Path of Building open it → Import/Export Build → Import character → your character → Items and Skills → Ctrl+S. Any build you follow compares against it, so renaming or updating the build is fine; the Gems tab uses it too (Equipped from → my character). Then Compare gear: your character on the left (blue), the build you follow on the right (yellow); green + lines are upgrades you still need. Path of Building does the import when you click it (Orbhoarder doesn\'t fetch character data itself), so redo it whenever your gear changes.' },
  { q: 'The trees don\'t move when I allocate passives.', a: 'That\'s on purpose: step along the build with the arrows next to "next" (‹ › one passive, « » five) on the passive tree and the atlas tree. Every panel shows the same step. Atlas ✓✓ jumps to the whole build or to nothing.' },
  { q: 'Can the price check compare an item with my character?', a: 'Yes: the PoB part of the price check has "vs build gear" and "vs character". "vs character" uses your character file (set it up once: Build panel → Gems → Equipped from: my character). It compares the item with the gear in that file, using the build\'s tree and gems. The file is only as new as your last Import character in Path of Building, so after changing gear click Update in PoB, import Items and Skills and save; the price check shows when the file was saved.' },
  { q: 'The price check shows no build impact.', a: 'Check Settings → Path of Building: build impact on, and a build picked in the Build panel. The first check after starting can take a few seconds while Path of Building loads.' },
  { q: 'The Whisper / Hideout button did nothing in game.', a: 'With Chat buttons set to "copy", the command is on your clipboard: press Enter in game, Ctrl+V, Enter. Set it to "send" to have one chat message sent per click.' },
  { q: 'Why does Hideout not take me to the seller?', a: '/hideout name only works when the seller lets visitors in. Most sellers invite you to their party after your whisper. Instant buyout listings use GGG\'s own Travel to Hideout button on the trade site (Trade site tab).' },
  { q: 'Who sees what I post on the friends\' board?', a: 'Only members of the POE-Builds GitHub organisation (your group). Each listing is a GitHub issue in the group\'s private repo, posted with your own GitHub sign-in, so it always shows who posted it. Only you can mark your listing done or remove it.' },
  { q: 'Do I have to sign in to the trade site?', a: 'Only for things that need your account on GGG\'s site, like Travel to Hideout for instant buyout. You sign in on GGG\'s own page inside the Trade site tab; it stays signed in and Orbhoarder never sees the login.' },
  { q: 'The game crashes with panels over it.', a: 'Set the game\'s Display mode to Windowed Fullscreen, and try Solid background (Settings → Panels → Show while playing). A crash on PoE 3.30 with Vulkan was fixed by switching the game\'s renderer to DirectX 12.' },
  { q: 'How do updates work?', a: 'Orbhoarder downloads updates by itself and installs them when the game isn\'t running (or click Install now in the window). Path of Building updates itself at the next start. After an update, What\'s new shows what changed.' },
  { q: 'How do I start over?', a: 'Orbhoarder window → Settings → Run setup guide (or the wand button on the overlay\'s top bar). The campaign guide\'s ↺ button starts the route again for a new character.' }
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
