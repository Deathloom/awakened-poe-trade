# Changelog

Changes in Orbhoarder (called Loot Goblin before 1.0.89) compared with [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade). Upstream's own changes are listed in [its releases](https://github.com/SnosMe/awakened-poe-trade/releases).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow the Orbhoarder releases (set when running the Release workflow), not upstream's version numbers.

**How to maintain:** every PR adds a line under **Unreleased**. Test releases (x.y.z-beta.N) leave it as it is. Before a stable release, rename **Unreleased** to the new version and date, and start a new empty **Unreleased** section.

## [Unreleased]

### Fixed (S5): other windows after renaming or deleting a build
- Renaming, moving, copying or deleting a build in Build manager now updates the build list, tree, tree map and gems in your other windows (overlay, desktop, HUD) too; before, they could keep showing the old build until you switched. New automatic checks cover which changes reach every window.

### Changed (S6): features your Path of Building can't do yet
- Orbhoarder now reads what its Path of Building copy can do when it starts. A feature that copy doesn't have yet is hidden (Craft → Timeless → Find seeds) or explained ("Your Path of Building is older than this feature…") instead of showing an error. Older copies are treated as the 22 Nov 2026 version.

### Security (F2b): phone key encrypted
- The phone link key is now kept with Windows' own encryption for your Windows user (it used to be a plain text file in the config folder). Your phone's saved link keeps working: the old file is moved over and deleted on the next start with phone access on.
- The Build checks on GitHub now also pin the upload/download steps to exact versions. Nothing changes in the app.

### Performance (F3): lighter windows
- The chart library (price check trend line, Market history sparklines) loads the first time a chart is shown instead of with every window: each panel and window starts with about a quarter less code to load (2.4 MB → 1.9 MB).

### Fixed (#287): ready-made atlas tree took other content's notables
- Picking **Threads** no longer takes "Threads are more likely to be of type …" notables (Dextral / Sinistral Threads) set to a type you didn't pick (e.g. Ultimatum): they're only taken, with your type chosen, when one of their options is a content you picked. "Cannot be of type" ones rule out a type you didn't pick.
- A notable that works inside another content (Trialmaster's Boon is Ultimatum even when it rewards Divination cards; Faith in Arms is Mercenaries) is only taken when that content is picked. Each stat line counts as the content it names first.

### Added: patch notes link and alert
- **Patch notes** link in Cheat sheets, Settings and What's new opens GGG's newest PC patch notes. When new notes (or a hotfix) are posted, Orbhoarder shows a Windows notification (click to read) and a yellow dot on the link until you open them. It reads GGG's public Patch Notes forum page every 30 minutes while it runs; turn it off in Settings → General. PoE1 only.

### Tests (Q1): data guards
- The automatic checks now fail if price check loses our added exchange items (Frayed Thread, Engineer's Orbs, the new Exalted Orbs, shards, Breach Blessings and others), if the atlas tree loses its 3.30.0c notables, or if the Threads cheat sheet or vendor recipes go missing. Nothing changes in the app.

### Performance (F4): even lighter windows
- Each panel and window starts with about a sixth less code to load (1.9 MB → 1.6 MB): the Atlas tree loads the first time you open it, and unused leftovers are gone. Nothing else changes.

### Performance (F4): one price download for all windows
- The poe.ninja price list (several MB) is now downloaded once and shared by the price check, Money tools, Market overview and Market history for up to 10 minutes, instead of each window downloading it on its own. Same prices, less waiting and less data.

### Performance (F4b): lighter windows, part 2
- Windows start with a little less code again (1.57 MB → 1.43 MB): the build panel's Gems, Tree, Tree map and Compare and the quest-gem data load the first time you open them, and the Lab and build-sync clocks rest while their window is hidden. Nothing else changes.

### Added (Q3): Thread planner
- **Cheat sheets → Thread planner**: pick a Thread (Abyss … Ultimatum) and how many you use (1–8) to see the guaranteed Thread mods, the 3 / 6 / 8 bonus you get and the next one, area-level notes, the cost per map at poe.ninja prices (chaos and divine, from the price list the app already downloads) and the atlas notables that help that Thread. The Map mechanics sheet and the planner now read the same Thread facts.

### Performance (F4c): lighter windows, part 3
- Windows start with a little less code again (1.44 MB → 1.35 MB): the campaign route, the campaign guide and the levelling planner load the first time one of them is shown; the level recorder waits for the route instead of needing it at start. If the route or the quest-gem data fails to load, it is tried once more; the guide then says "Couldn't load this panel" with a **Retry** button, and opening the panel again tries again, instead of staying empty. The levelling planner works without the route (act 1, no guide points). Nothing else changes.

### Added (Q2): Challenges
- **Cheat sheets → Challenges**: all 40 Covens of Umbra challenges with their steps, a tip and a link to the cheat sheet that helps (Vendor recipes, Thread planner, Map mechanics, Covens, Endgame bosses, Checklist). Tick challenges and steps yourself (x/40); saved on this PC per league, so a new league starts empty. Nothing is read from your account.

### Added (Q4): map check warns for your PoB build
- With a Path of Building build active, the map check marks mods dangerous for that build (red edge and hammer; hover for why: thorns/reflect for melee, no regen or less recovery for regen/leech builds, less max res when your over-cap is low, curses unless you're curse immune, ailment avoidance for ignite/poison builds, …) and greys mods that don't affect it, using the stats PoB saved in the build file; your own colours stay, **?** shows the legend, Settings → Maps → Warn for my PoB build turns it off. Mods dangerous for every build (more monster damage or crit, penetration, poison on hit, …) are never greyed. Security: reading a build file (map check, Compare builds) now checks the real path, so a link inside your builds folder can't point to a file outside it.

### Changed: Beasts / Syndicate atlas trees take Thread type notables
- Ready-made atlas tree: picking **Beasts** or **Syndicate** now also takes Sinistral Threads (set to Bestiary / Betrayal) and Unthreaded (ruling out another type), which were missed before.

### Added (Q5): Fate reward values
- **Cheat sheets → Covens → Fate reward values**: the Fate reward types with their poe.ninja price per item (from the price list the app already downloads), dearest first with a star, and how many copies of a Fate pay (2 for the single Divine Orb / Orb of Annulment outcomes, otherwise 1 or 3). Counts GGG hasn't stated are said so; random drops show no price. Closed until you open it.

### Added (Q6): price alerts on your phone
- **Market → Watched / Shopping → ⋯ → Price alert above / below…**: pick a price in chaos or divine; when Orbhoarder's normal poe.ninja refresh crosses it, a phone connected with the QR link (Settings → Tools) shows the alert at the top of the page, otherwise (or if the phone doesn't confirm within a few seconds, e.g. it's locked) you get a Windows notification. Prices are only checked when Orbhoarder refreshes them anyway (about every half hour while the price check, Market or Money tools is in use), so with nothing like that open no alert fires. Each alert fires once per crossing (at most once an hour); add and remove alerts on the PC, the phone can only dismiss them. No extra downloads, nothing leaves your PC except to your own phone. Security: a connected phone can no longer become the window that gets the price check's item text (it could take over the next price check); connections that stop answering (a locked phone) are closed after about a minute.

### Added (Q8): deaths and pace log
- **Levelling → Pace**: each character you follow from level 2 is saved as a run (act splits, your level and deaths per act, levels per hour of campaign time; Client.txt has no experience numbers, so it's levels per hour, not XP/h) and compared with your best or last earlier start (⋯ to pick another or forget a run; **?** explains the numbers). Only your own character's deaths count. Up to 10 runs (newest, and always your best) are kept on this PC only; Rebuild from game log fills in older characters (the last 20 characters the planner keeps). A character deleted and made again with the same name starts a new run. Security: a connected phone can no longer take the lines written while Orbhoarder was closed (the PC then missed those levels, deaths and splits), and reading the whole game log runs once at a time instead of once per request.

### Added (Q10): loot filter add-on
- **Market → Shopping → ⋯ → Make loot filter add-on…**: pick your loot filter (a .filter file in Documents\My Games\Path of Exile) and Orbhoarder writes a new file next to it, "your filter + Orbhoarder.filter": big, highlighted Show blocks for what the list still needs (uniques by base type, the rares' bases with every drop of that base highlighted, gems in PoE1; transfigured gems as their normal gem; names the app's item data doesn't know are left out, because the game won't load a filter with an unknown name), then your filter copied unchanged; pick it in game under Options → UI → Item filter. Your own filter file is never changed; make it again when the list changes. Security: only on the PC (not from a phone), only .filter files directly in that folder (links leading outside it are refused), at most 8 MB, and the only file ever written is the "+ Orbhoarder" one (a file of that name that Orbhoarder didn't make is left alone).

### Added (Q7): Lab helper while levelling
- **Levelling → Next steps → Labyrinth**: a checklist of the 12 Labyrinth trials (6 Normal, 3 Cruel, 3 Merciless), per character, ticked from your local Client.txt (a trial-completed message in that zone, or entering that lab) or by hand; labs done count from Izaro's "Triumphant at last" or entering a higher lab, or can be typed in; plus the next lab and the ascendancy notables your Path of Building levelling tree adds (not taken yet; PoB sets no order, so none is claimed). Replaces the "Ascendancy in this tree" box. The campaign guide ticks trials it knows are done, and in the Orbhoarder window its lab banner lists those notables too.

### Added (Q9): bench recipe checklist
- **Cheat sheets → Bench recipes**: the crafting bench recipes on the campaign route, by act and zone (the same places the campaign guide shows), with the next one ahead of the guide's step and a count of unticked ones in zones you're past. Click a recipe in the guide's "crafting recipe" line to tick it there; ticked ones are crossed out in both. Ticks are by hand (the game log doesn't say when you pick one up) and account-wide on this PC, like recipe unlocks in game.

### Security: Dependabot version updates
- `.github/dependabot.yml`: weekly update PRs (Mondays) for main and renderer npm packages and the pinned GitHub Actions, all to **dev**; minor and patch bumps grouped, at most 3 open per folder. Nothing changes in the app.

### Tidy-up (S8): fewer background timers, less dead code
- Market history (Farming) and price alerts stop their 30 s / 60 s refresh while their window is hidden and catch up when it is shown again. A stray Python package file was removed from the source and unused leftovers are gone. Nothing else changes.

### Security (S1): phone access is an allow-list
- A phone or other device may now only send the overlay requests that are listed as allowed; anything new or unlisted is refused (it used to be allowed unless listed as refused). Phone panels work as before. A test now fails if an overlay request is added without deciding whether phones may send it.

### Security (S2): Path of Building 2.69.0 with the open-request hardening
- Path of Building moves to the fork's 2.69.0 release (upstream 2.69.0: loadout manager, item type icons, 3.30 Imbue gems, Viscera, Wickerman and Covetous Dark fixes). It also brings PoB fork #44: when Orbhoarder asks PoB to open a build, PoB now only opens local drive paths to real PoB build files (no network share paths). Update in PoB works as before. (#309)

### Added (A1): PoE2 game data
- Orbhoarder now ships the PoE2 item and modifier lists (English) from Exiled Exchange 2, kept separate from the PoE1 lists. Nothing uses them yet: they are the groundwork for PoE2 price check. Credited in the README and LICENSE.

### Security: minimatch fix in the renderer lint tools
- Renderer dev tools: typescript-eslint 8.72.2 → 8.74.0, which moves minimatch 10.2.6 → 11.0.9 (GHSA-g3hv-75wg-m249, moderate, denial of service from crafted glob patterns). Lint only; nothing in the app changes. The same alert in main (electron-builder's build tools) has no fix in electron-builder 26 yet and stays open.

## [1.0.97] - 2026-11-20

### Fixed (#282): price check couldn't be clicked (1.0.96)
- A 1.0.96 security change dropped the overlay's own messages to the app (where the price check is on screen, and "back to the game"), so the price check window couldn't be clicked. They work again; phones still can't send them.

## [1.0.96] - 2026-11-20

### Security (F1 follow-up): Content-Security-Policy
- Orbhoarder's own pages only run scripts that ship with the app (no inline or injected scripts, no plugins) and can't be framed by other sites.

### Security (F1 follow-up): build folder checks
- **Copy builds** from another folder only copies from a folder you chose with **Choose folder…** (or the other PoB that was found).
- A player name that isn't a plain folder name (e.g. `..` or `a/b`) is ignored and the builds folder is used, so build backups and deleted builds can't land outside it.

### Security (F2 review): build pipeline and problem reports
- Problem reports and Bug button logs now also hide your Windows user folder when a log spells it in lower case, with / or doubled \\ (before only the exact spelling was hidden).
- Build checks on GitHub can no longer publish or write to the repo (read-only, pinned actions); the release job no longer leaves its token where install scripts could read it. Nothing changes in the app.

### Security (F1 follow-up): overlay browser and DevTools
- The overlay's web browser no longer downloads files (like the Trade site and Lab tabs); open the page in your own browser to download. Redirects are held to web links like normal links.
- DevTools (Ctrl+Shift+I) is off in the installed app; start Orbhoarder with `--devtools` if support needs it.

### Security (F1 follow-up): what a phone can do
- A phone or other device on the phone link can use the panels as before, but can no longer change settings, folders, PoB install, sign-in or phone access, or send anything to the game (chat commands, stash search). Those stay on this PC.
- Settings → Tools says the phone link isn't encrypted: home Wi-Fi only, turn it off or press New key on shared networks.

### Security (F1 review): phone access key can't be skipped
- With **Settings → Tools → Phone or other devices** on, another device on the network could reach the local server without the key by sending a made-up `Host: 127.0.0.1` header. The server now checks where the connection really comes from; this PC still needs no key, phones still use the QR link.
- A malformed message from a window is ignored instead of raising an error report.

### Security (F2 review): installed app and test releases
- The installed app can no longer be started as a plain Node.js runner or with a debug port (`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect`), so other programs can't use it to run their own code. The app itself works as before.
- Test releases can only be built from dev (or master), never from another branch.

### Changed (#278): ready-made atlas tree previews first
- Atlas → ⋯ → Ready-made atlas tree: **Generate** now only shows the tree on the atlas (with its stats), nothing is saved. Change the picks or points and **Generate again** as often as you like, then **Save** it once (or **Discard**). Closing the panel or picking another atlas build discards the preview.

### Changed (#279): cheat sheets for 3.30.0d
- Covens: outcomes that guarantee a single Divine Orb or Orb of Annulment need 2 Fate copies (not 3); Fate counter in the area; Abomination map's Nightmare of the Depraved Trinity is the only boss there with the Fate empowerment.
- Map mechanics: new Abyss and Incursion Thread mods, rarer Breach Wombgift mod, Hiveblood from the Breach Sapling, currency drop changes (rarity raises currency quality, Foulborn orbs drop anywhere, Originator's and Primordial Exalted Orbs), Blight Currency Lanes and Sacred Fauna lifeforce.
- The 3.30.0d hotfixes (Covetous Dark, Headhunter, Abyssal mods, Witch of the Woods, duplicate rares) change nothing in Orbhoarder.

## [1.0.95] - 2026-11-20

Hotfix: only this fix on top of 1.0.94 (the rest of dev ships later).

### Fixed (#272): tree map didn't follow a build switch
- Switching build, character, loadout or player in the Build panel (or making, copying or deleting a loadout) now reloads the tree map, passive tree and gems in every panel and window, e.g. the tree on the right of the Levelling layout. Before, only the panel you clicked in got the new build.

## [1.0.94] - 2026-11-20

### Changed (#264): Shopping list you can shop from
- **Market → Shopping**: every row has **Trade** (opens the trade site: uniques any copy, rares this base with these mods, gems cheapest first) and gear rows have **↑** (same unique with at least these rolls / any base with these mods), the same searches as the Build panel's Gear tab. Click a gear row to see its mods. Rares now get their own row (no price: it depends on the rolls).

### Added (#263): league challenge vendor recipes
- **Cheat sheets → Vendor recipes**: recipes that count for this league's vendor-recipe challenges (Peddler's Produce I and II, Covens of Umbra) carry a 🏆 line naming the challenge and item. New recipes for the challenge items the list didn't have: Ruby / Topaz / Sapphire ring, Agate / Turquoise / Citrine amulet, Tier 16 map, unique reroll, influenced Onyx Amulet. (#265: one list instead of separate challenge cards.)

### Changed (#262): 3.30.0c / 0d patch notes
- **Atlas tree data 3.30.0c** (GGG's export, 19 Nov): new Celestial Presence and Runic Distortion notables, Bountiful Harvest / Ancient Writings / Phantom Anomalies wording.
- **Price check data**: 25 exchange items the trade site has but our data lacked (upstream's 3.30 data replaced our earlier additions): the new **Originator's Exalted Orb** and **Primordial Exalted Orb** (3.30.0d), plus Frayed Thread, Engineer's / Infused Engineer's Orb, Cartographer's Chisel, Orb of Horizons, Harbinger's Orb, Dead Man's Sulphur, currency shards, Breach Blessings, Shaper / Elder / Uber Elder / Sirus fragment sets and four legacy Omens. English only. The two new orbs are in Market → Crafting too.
- **Cheat sheets → Threads**: guaranteed mods by Thread count, the 3 / 6 / 8 Thread bonus per league, new Thread and Viscera vendor recipes noted.

### Changed (#261): easier to read, less crowded; tree map starts at your level
- **Easier-to-read small print** (on by default) now also brightens greyed text: three text levels instead of six, faded rows (done steps, taken passives) less faded, a bit more space between lines, and the levelling section headers follow the theme.
- **Campaign guide** (window): the act's finished steps fold into one "N steps done" line (click to show); more space between steps; the colour legend moved to ⋯ → What the colours mean.
- **Next steps**: roomier sections; the long "one tree only" note is one line (hover for the rest).
- **Cheat sheets**: normal-size text, bold section titles, more space.
- **Tree map, levelling**: a tree you haven't stepped through yet starts where your level and quest points say you are (same number as Next steps), not at the game log's short run (switching to the next tree in PoB showed 5/88). New **My level** button jumps back there. The "live character is turned off" notice no longer sits over the levelling and switch maps.
- **Market → Outlook**: no more +60% on everything (that was a cap). The real 3-day projection is shown; items moving over 100% (thin markets, e.g. 1c gems bought out) say "too fast" and stay out of Outlook (see Rising). New line on top checks the outlook against this week's own prices: how many picks really rose and the typical miss. The sticky table header no longer lets the first row show through.
- **Levelling order** (PoB fork #43): finishes a branch before starting another, so the next 5 passives no longer jump across the tree.

### Changed (#260): Calmer panels part 3
- **Atlas**: header is now build picker, Edit, zoom, fit, Stats and one ⋯ menu (add from a link, ready-made tree, copy to mine, rename, copy link, open on pathofexile.com, taken all/nothing, delete). Rename has Save/Cancel; empty atlas shows Add buttons.
- **This session**: stopwatch play/pause stays; Reset stopwatch and Start a new session moved to ⋯. Loot buttons use the shared button look.
- **Craft**: main buttons, tabs and input focus use the theme accent like the rest of the app.
- **Settings**: Save/Cancel, Tools, Path of Building, Panels and Appearance buttons use the shared button look; the picked settings page is easier to read (accent mark). Theme touches (Potato, Comic, Vendor, Mirror) now apply to the shared buttons too.
- Help: Atlas entry updated (⋯ menu, step arrows instead of auto-ticking).

### Added (#259): Market tools
- **Shopping**: your followed build's uniques and gems with the cheapest poe.ninja price, a total of what's still to buy, and got-it ticks (uniques share the Build panel's tick).
- **Sell list**: add what you plan to sell; today's value, a week of prices, a sell-soon / can-wait hint, and a copy button for a `~price` note.
- **Farming**: name your strategy; maps with loot added in This session show profit per map and per hour by strategy or league mechanic (kept on this PC).
- **Crafting**: crafting currency prices with a week's trend, how many per divine, and a sum of what your craft costs.
- **Divine ratio and wallet**: the Market bar shows 1 div = … c with its trend; click for a chaos ↔ divine converter and your wallet total from the currency counter.

### Changed (#258): calmer Market, Trades, Board, Market search, Money and Cheat sheets
- Same tab look in every panel header as the Build panel (Market, Trades, Friends' board, Money tools, Cheat sheets).
- Market → Watched: each item keeps its Alert button; Open on poe.ninja and Stop watching moved into a ⋯ menu.
- Main actions stand out in the accent colour (Post, Post to the board, I want it / I have one, Search); everything else uses the normal or quiet button. Fewer one-off colours (blue, green); Remove turns red only while it asks to confirm.

### Changed (#257): calmer Levelling tab, one button look everywhere
- Campaign guide: ‹ › step arrows and one ⋯ menu (Show the whole act, Show optional quests, Start over) instead of five loose icons.
- Next steps: one header line (character · level · points) with a **Level** button that opens the character, level and quest-point boxes (they open by themselves while no level-up has been seen). Section buttons (Whole order, All acts, …) look like buttons.
- Every small icon or text button across the app (atlas, tree map, build tools, session, market, trades, board, settings, help) now uses the same quiet button style, so it's clear what's clickable.

### Changed (#256): overlay review, part 2
- Overlay panels have a drag bar on top (like the pinned panels): drag it to move the panel. Market search and Cheat sheets couldn't be moved before.
- Build panel: price check is in the ⋯ menu in the Orbhoarder window too (opens over the game). In the overlay and in game, ⋯ → "Compare, edit loadouts, manage builds" opens the Orbhoarder window on the Build tab.
- Help, setup guide and panel notes checked: Where panels show, Show while playing and Chat buttons are in Settings → Panels (not Path of Building); hotkeys in Settings → Hotkeys; the Build panel's buttons are in its ⋯ menu; build sharing is Build panel → ⋯ → Build sharing; any panel can be pinned in game.

### Fixed (#255): overlay panels move and open on their own
- A panel's hotkey pressed in game shows only that panel, not the menu bar and every other open panel (Shift+Space still shows everything). Closes as before: hotkey again, Esc or click the game.
- Overlay panels (build gear, guide, trade companion, market search/history, friends' board, tree, atlas, session, overview, cheat sheets, money) get a Move square on every corner; before, Move gave one tiny square at a single point.
- Help: how to move overlay panels, and that click-through pinned panels need Shift+Space before dragging.

### Fixed (#254): "vs character" said "equipped needs 'items'"
- Path of Building only updated at the next Orbhoarder start when its window was open, so the new character-file compare hit the old PoB. Orbhoarder now checks every minute and updates PoB as soon as its window is closed. Until then the price check says to close PoB instead of showing the raw error.
- Price check: "vs build gear" / "vs character" now look like buttons; when "vs character" can't be used, it's greyed out and its tooltip says why.

### Fixed (#253): Path of Building slow to start gave errors
- Orbhoarder now starts Path of Building in the background and loads your build a few seconds after it opens (and after PoB settings change), so the Build panel and price check don't hit a cold start. Loading or editing a build may take up to 2½ minutes before it counts as an error (was 30 seconds); other requests wait for it instead of failing.

### Added (#252): price check "vs character" is back
- The PoB part of the price check compares the item with **your character's gear** again ("vs character"), now from your character file (Path of Building's own Import character, the same file as Gems and Compare) instead of GGG's character pages. Uses the build's tree and gems; shows when the file was saved. Not set up yet: it says how (Build → Gems → Equipped from: my character). Needs the PoB fork from 19 Nov 2026 (comes with this version).

### Changed (#251): Update in PoB opens your character's file on the Import tab
- **Update in PoB** (Gems tab) and **Open Path of Building** in Compare now open your character's file in Path of Building straight on the Import tab. If PoB is already open it switches to that file (asking to save unsaved changes first) instead of starting a second PoB. You still pick the character and click Items and Skills yourself. Needs the PoB fork from 19 Nov 2026 (comes with this version); an older or separate PoB just opens as before.

### Changed (#250): one Gems view, and your character's file belongs to the character
- **Gems** is one view instead of "For my level" and "Whole build": a top bar (level, the build's stage, **Equipped from: my ticks / my character**), a **Change now** box only when there's something to do (take out, socket, level up, with counts), the gear pieces with each link group's gems marked ✓ have / ◐ lower / ○ missing / 🔒 at level X plus build and your sockets, and **Coming up** (next stage) collapsed at the bottom. With stages, only the current stage's groups show.
- **Your character's file** is now "My characters/<character name>.xml" (name from the game log, or typed in once), not "<build> (my character)". Any build you follow compares against it, so renaming or updating the build doesn't break it. Pick or change the file per character; an older "(my character)" copy is offered with **Use it**. Compare, the Gems tab and Help are updated.

### Added (#249): Gems tab compares with your character (optional)
- Gems → Whole build has a **Compare with my character** tickbox (off by default). It reads the "(my character)" copy that Path of Building imported and marks each gem ok / lower level or quality / missing, with your sockets per slot. Re-read after saving in PoB.
- Compare (Build → ⋯): shows whether it's set up, a clearer first-time guide (which file to open, account name with #1234, tick Delete equipment/skills, Items and Skills only), what to do when gear changes, and how to open Path of Building yourself (button, tray icon, Settings → Hotkeys).

### Changed (#248): calmer Build panel (first step of the UI clean-up)
- Header: the tabs, the build name, one **Build** button (pick build / loadout), reload, and one **⋯** menu with labelled entries (import, sharing, what changes, compare, edit loadouts, manage builds) instead of 8 loose icons.
- Gear rows: tick, item, defences, then **Trade** and **Upgrade** as labelled buttons and a **⋯** menu (copy name for the market, craft it, stash / vendor search, price check).
- The button legend moved behind a **?** (remembered); Show mods moved next to it.
- New shared button look (ui-btn) and menu (UiMenu) for the rest of the app to follow.

### Changed (#247)
- **Build → Gear:** a "got it" tickbox on every item (ticked items fade, per build and item set); uniques get ↑ too (the same unique with at least these rolls); the buttons line up in the same columns on every row.
- **Compare gear is clearer:** mods are matched by wording, so per slot you see ○ still need, ◐ have it but lower (your value → the build's), ✓ already have, and extras on yours, instead of a list of + and − lines.

### Added (#246)
- **What changes between stages** (Build panel → route icon): compare the loadout you play with any other loadout of the build (Early → Mid, Level 30 → 60, Elementalist → Occultist…). Lists gems to swap, passives to take and refund (notables by name), gear changes and Wickerman changes, and warns when the ascendancy or class changes. "Switch to" picks that loadout. Works with every kind of build: guide stages with their own gear, trees only, branching variants and placeholder gear ("any Vaal Regalia"); a single poe.ninja character simply has nothing to compare.
- **"Which loadout do you play in maps?"** Once the All tab switches to Mapping, builds with several loadouts ask once (Use it / Not now). Orbhoarder never picks one by itself.
- **Wickerman in Build → Gear:** the build's Viscera per slot with poe.ninja prices and a total. Hidden when the build has no Wickerman.
- Levelling guide: clearer note when a build has only its final tree.

## [1.0.93] - 2026-11-19

### Fixed (#243)
- **Automatic problem reports only for real bugs:** messages meant for you (timeless seed out of range, a base type PoB doesn't know, a loadout name that isn't in the build) and cancelled price downloads no longer open reports. The poe.ninja download that a newer one cancels no longer shows up as an error at all.

### Changed (#241)
- **Path of Building 2.68.1** (from PoB Community, 17 Nov): full 3.30 support: 3.30 uniques and changes, Wickerman equipment and Viscera mods (also on character import), Reliquarian mods, Putrid Seed jewel, 3.30 flask mods, and fixes (imbued support gem import crash, Excommunicate, ??? on pasted 3.30 items). 

### Changed (#240): merged upstream Awakened PoE Trade (3.30 updates, 17–19 Nov)
- Game data updated to 3.30.0.3 (items, mods, trade stats in all languages).
- Price check: Atlas Drops is its own map filter (next to Item Quantity), Twice Corrupted items show "Twice corrupted", Viscera and Threads supported, rare-only mods and 9-mod maps, new textual ranges, mod reminder text, "Not Catalysed" filter for jewellery, updated Chronicle of Atzoatl rooms. These replace Orbhoarder's own earlier stopgaps for Atlas Drops, Twice Corrupted and the temple rooms.

## [1.0.92] - 2026-11-19

### Fixed (#237)
- **Build → Gear → Trade** searches that item's base type (e.g. Profane Wand) with all its mods ticked (at least these values); before, the mods came through unticked and it searched any wand. **↑ upgrade** does the same for any base of that kind.

### Fixed (#236)
- **Compare:** your character is always on the left (blue) and the build you follow on the right (yellow), even if the pickers were the other way round.

### Fixed (#235)
- **"Failed to load leagues" / price check not working:** Orbhoarder now talks to pathofexile.com with exactly the same browser string as its Browser window, so passing GGG's Cloudflare check there works for the price check too (before, the check you passed never applied). The error now says why (browser check, maintenance, too many requests) instead of a list of headers.

### Changed (#234)
- **Compare builds is clearer:** names instead of A / B ("Your character", "Build you follow", or the build's name), left (blue) / right (yellow) pickers, "Difference" column. Your character is now on the left and the build you follow on the right, so green + lines are the upgrades you still need. Step-by-step how-to and tooltips for the character import; Help → FAQ explains it and the tree arrows.

### Added (#233)
- **Your character vs your build:** Build → Gear → ⚖ Compare has a "Your character vs this build" helper. Make a copy of the build ("… (my character)"), open Path of Building, import your character's Items and Skills into that copy and save, then Compare gear shows each slot side by side. Path of Building does the import when you click it (within GGG's rules); Orbhoarder only reads the saved file. Redo it whenever your gear changes.

## [1.0.91] - 2026-11-17

### Added (#230)
- **Build → Gear shows defences:** Armour, Evasion, Energy Shield, Ward and Block next to each item (e.g. "AR 520 · ES 80"), and as the first lines when you open the item's mods.

### Changed (#229)
- **Passive tree and atlas tree: step with arrows instead of automatic following** (Gerhard: much less complicated). « ‹ step/total › » next to "next": forward or back 1 or 5 passives along the build's order. Taken, next 5 and the zoom follow your step; the Levelling guide's passive list agrees with it. The same step shows in every panel and window. First time per build it starts where the old automatic tracking had you. Atlas ✓✓ jumps to the whole build or to nothing.

### Changed (#228): 3.30 patch notes and hotfixes check
- **Covens cheat sheet:** same Fate 3 times now triples the 1st and 3rd copy's reward (2 copies is a waste) (3.30.0b Hotfix 3).
- **Map mechanics sheet:** the strongest Thread effects need 2+ Threads and area level 73+/80+ (3.30.0b Hotfix 3).
- **Progress checklist:** atlas points per pinnacle boss (Exarch / Eater / Maven +2, each Maven Invitation +2, Uber Elder +4).
- **Vendor recipes:** 2 same-name rares → Chaos Orb, 3 → Exalted Orb; Vaal Orb from 5 Vaal gems.
- **Price check:** Twice Corrupted items count as corrupted; Chronicle of Atzoatl reads the renamed temple rooms (Cradle of Creation, Royal Forge, Grand Reactor).

### Fixed (#227)
- **Tree map in the Mapping layout now follows what you allocate** (it only did when the Levelling guide panel was also on screen).

### Fixed (#226)
- **Settings → Panels in the Orbhoarder window:** it was only in the in-game overlay's settings (Shift+Space → Settings). Now under Appearance in both.

### Fixed (#225)
- **Settings → Tools → Phone or other devices:** the tickbox was missing and the line did nothing when clicked (the page never loaded the tickbox). It works now.

### Fixed (#224)
- **Atlas tree "taken" count:** taking one passive could mark several as taken (many small atlas passives share a name, and it filled the path to a same-named one deeper in the build). Taken now grows out from the start through passives you've actually taken, like the game allows. If taken looks short after updating, use ✓✓ → "I have this build".

### Changed (#223)
- **Mapping layout default** (Gerhard's own arrangement): Build / Trades / Market | Atlas tree / Cheat sheets | Tree map / This session / Money tools. Edit layout → Reset gives you this one.
- **Atlas tree opens zoomed on its target** (next passives, else the build), also when you switch atlas build, like the passive tree.

### Fixed (#222)
- **Tickboxes instead of switch icons** everywhere in Settings: the switch icon didn't show on some PCs, so options looked like plain text.
- **Tree map always opens zoomed in** and always has the **target** button: next passives of the levelling plan, else the build's passives you haven't taken yet, else the whole build (before, without a levelling plan it showed the whole tree and no target).
- **Settings → Panels: "One window for all pinned panels"** is always listed (it only showed once a panel was pinned).

### Changed (#221)
- **Mapping layout has the Tree map** (you still level in maps): Tree map / Build / Money tools in the right column. Mapping layouts saved in 1.0.91-beta.1 to beta.3 get it added once, above Build.
- **Atlas tree: target button** (crosshairs, next to Fit) like the passive tree's: zooms to the next passives to take, or to the whole build when nothing is left. The atlas also follows the next passives as you take them in game (not while editing).
- **Switches easier to see:** off switches are light grey instead of near-invisible, on switches use the theme's accent (e.g. Settings → Tools → Phone or other devices).

### Changed (#220)
- **Clean look:** Settings **Save** is now the accent-coloured main button, and the picked theme in Settings → Appearance is tinted with the accent (no more plain grey row).

### Added (#219)
- **More poe.ninja prices:** Wombgifts, Scrying Orbs, Memories, Temples, Shrine Belts, Forbidden Jewels, Imbued Gems, Valdo Maps, Cluster Jewels and Flasks now load. Market gets a **League items** group (Threads, Viscera, Wombgifts, Scrying Orbs, Memories, Temples); Atlas value counts Wombgifts for Breach and Temples for Incursion. Price checks that worked before are unchanged.

### Added (#218)
- **All tab: Levelling and Mapping layouts.** Auto (default) switches to the Mapping layout when you enter your first atlas map, and back to Levelling when a new character starts in The Twilight Strand. Mapping layout: This session, Trade companion, Market | Atlas tree, Cheat sheets | Build, Money tools. Each layout has its own Edit layout; pick one by hand with the layout menu next to Edit layout.
- **Phone or other devices:** QR code to scan with your phone, a **Restart now** button after switching it on (the link appears after the restart), and a note when the PC has no network address.
- **Gear regex:** armour, evasion, energy shield, ward (at least this value) and the item's link count can be ticked too.

### Added (#217)
- **Build → Gear: regex button** next to each item. Tick the item's lines (base type or unique name, each mod with "at least this value" or any value) and get a stash / vendor search for items like it, with the 50-character count, Copy and Save (to Notes → Search strings, where it can get a hotkey).

## [1.0.90] - 2026-11-16

### Added (#214)
- **Timeless jewel: Find seeds.** Craft tab → Timeless jewel → Find seeds: pick the jewel and socket, then what you want (a passive or stat on a certain notable, or a stat on at least N notables anywhere in the radius). Orbhoarder lists the best seeds, what each one gives, a button to show all its passives and a trade search for that seed with any conqueror.

### Changed (#213)
- **Test builds** now get their Path of Building version from the testing branch, so testers get a new PoB (like the 3.30 one) before everyone else. Stable builds are unchanged.

### Fixed (#212)
- **Map price check (3.30):** Atlas Drops now searches the trade site's own Atlas Drops filter instead of the old Item Quantity one, so 3.30 maps find matching listings.
- The weekly data refresh now opens its pull requests against dev.
- **Prices (3.30):** Threads and Viscera now show poe.ninja prices (price check, market overview, profit tools).

### Added (#209)
- **Price check data for new leagues:** a new once-per-league job adds the trade site's new items, uniques, mod lines and bulk-exchange tags to the price check data in all four languages, without changing what's already there.

### Changed (#208)
Path of Building updated for league 3.30 (Covens): the 3.30 passive tree, new uniques, Wickerman gear and Viscera mods, Polaric Devastation and the new flask mods. It arrives the next time you start Orbhoarder.

### Added (#206)
- **Craft this** (flask button on rare and magic items in Build gear): opens the Craft tab with that base and item level, ticks its mods at the tier your item has, and shows **How to craft** in order: the base and item level to get, the cheapest way to roll the random mods (Chaos, Alteration/Regal or an Essence, compared on poe.ninja prices), the rarest mods first and Exalted Orbs (or bench) for the rest, bench crafts last, then Divine Orb. Mods it can't roll on that base (fractured, veiled, Eldritch, influence) are listed. Fossils and Harvest aren't covered yet.

### Added (#205)
- **Passive tree, switching builds:** pick **Switching from** above the tree (it fills in by itself when you change your active build in Path of Building) to see what to respec: passives only in the old build are red (**to remove**, with the list outermost first and how many Orbs of Regret), passives in both are green (keep), new ones orange (to take).

### Fixed (#205)
- **Passive tree showed small passives as taken that you hadn't taken** (e.g. a Strength or Intelligence node on a loop). The game log only names passives, so Orbhoarder guesses where each one is; a rule that filled in any build passive between two taken ones lit passives you had gone round. Now it only fills in the shortest path a taken passive needs to connect to your start.

### Fixed (#204)
- **Campaign guide follows your character:** each character keeps its own step, so switching characters no longer shows another one's act. A character you haven't used with the guide yet starts at the act it was last in.
- **Campaign done:** after Kitava in act 10 (or once the character has been in a map) the guide says the campaign is done instead of showing Act 1; **Show the route anyway** brings it back. The area level is only shown in campaign zones (a map's level next to "Act 1" was confusing).

### Fixed (#207)
- **Price check on 3.30 Threads** (Blight Thread, Breach Thread …), Frayed Thread, Threaded Delirium Orb, Maven's Chisel of Threads and Soul Cores: the item list didn't have them, so the price check didn't know them. Also added currencies the trade site lists again (Engineer's Orb, Cartographer's Chisel, Orb of Horizons, Harbinger's Orb, the orb shards, Breach Blessings). English game client only for now.

### Added (#202)
- **Atlas tree, switching builds:** pick **Switching from** (it fills in by itself when you change atlas build) to see what to respec: passives only in the old build are red (**to remove**, with the list outermost first and how many Orbs of Unmaking), passives in both are green (keep), new ones orange (to take). The next-5 steps start from what you keep.
- **Easier-to-read small print** (Settings → Appearance, on by default): hints, notes and counts are a bit bigger and brighter and use a plain font even when the theme uses Fontin.

### Changed (#202)
- **Atlas search** is much easier to spot: everything else dims, matches get a big yellow ring at any zoom, the box shows how many it found, and Enter (or clicking the count) zooms to each match in turn. Esc clears it.
- **Build gear buttons:** in the Orbhoarder window the magnifier only repeated **Trade**, so it's gone there (it opens the price check in the overlay, where it's still shown). The line above the gear now says what each button does.

### Fixed (#201)
- **Ctrl+T is free for skill 13 now.** The one-time move of the trade companion from Ctrl+T to Ctrl+B never ran on existing installs (it thought it had already run), so Ctrl+T still opened the trade companion. It runs on the next start; if you already use Ctrl+B for something else, Ctrl+T stays and its box is orange so you can pick another key.
- **Hotkey boxes:** the orange "the game uses this key" warning and the red "Not Set" now actually show; a general field style hid them in every theme.

### Changed (#200)
- **Clean look, step 3:** price check rows are calmer (lighter lines, a light band on hover), ticks use the accent colour, tags like *pseudo* and the min/max fields are easier to read, **Search** is the main (accent) button and **Collapse** is a quiet text button. Overlay menu bar: calmer icons, and open panels get an accent underline instead of a grey outline. Settings pages use the full window width and hotkey boxes use the normal font.
- **Settings title** says Orbhoarder (was Awakened PoE Trade).
- **What's new** shows one Changed / Added / Fixed heading per version instead of one per change.

### Fixed (#200)
- **Setup guide:** on a new install it no longer stops at "Checking build sharing…"; its first check ran before it was ready.
- A start-up error in the league list while the settings were still loading.

### Changed (#198)
- **Orbhoarder window top bar** stays on one line: smaller tabs, the active tab in the accent colour, icons only on narrow windows (hover for the name), and it scrolls instead of wrapping.
- **Clean look:** quieter borders on text fields and drop-downs (the focus ring stays); price check filter buttons that are on get an accent outline and tint instead of a bright grey line.

### Changed (#196)
- **New default look: Clean.** Flat panels, neutral greys with more contrast, the system font (Segoe UI), calmer top bar, slimmer scrollbars and clearer buttons, in the overlay, the in-game panels and the Orbhoarder window. If you were on the old default (Classic) you move to Clean once; any other theme you picked stays. Classic and the other themes are still in Settings → Appearance. First step of the look overhaul.

### Added (#195)
- **Craft tab** in the Orbhoarder window:
  - **Crafting simulator:** pick a base, item level and up to two influences, tick the mods you want (and the lowest tier you'd accept). Simulate shows the chance per try, the average number of tries and the average cost in chaos (poe.ninja prices) for Chaos Orb spam, Alteration + Augmentation, Alteration then Regal, and essence spam; **Compare all** sorts them by cost. Mod pool and spawn weights come from Path of Building's game data. Fossils, harvest and metacrafts aren't covered yet.
  - **Timeless jewels:** pick the jewel, its conqueror, the seed and a socket (your build's sockets first) to see every passive it changes, with new stats highlighted and the passives your build takes marked. **Find on trade** searches the trade site for that seed. Needs the updated Path of Building (it updates by itself).

### Changed (#194)
- **Trade companion hotkey is now Ctrl+B** (was Ctrl+T, which is PoE's key for skill 13 on the second skill bar; Orbhoarder caught it first so the skill never fired). If you still had Ctrl+T it moves to Ctrl+B, unless you already use Ctrl+B for something.
- **Game-key warning:** a hotkey box turns orange when the key is one PoE uses by default (skills, flasks, Ctrl+C, Ctrl+F and so on), with what the game uses it for.

### Changed (#193)
- **One Market panel:** Market overview (all poe.ninja prices) is now the **All prices** tab of the Market panel, next to **Watched** (your watched items and alerts). If you had Market overview pinned or on a hotkey, Market gets the pin and the hotkey. The Orbhoarder window's Market tab still shows both side by side.
- **Map mods:** Settings → Maps (every build, this PC) and Build panel → Notes (this build, shared) now say which is which; the map check uses both, as before.
- **Shorter ? help** on the overlay bar: the hotkeys, then a button to the full help.
- This session's Trades count points to the Trade companion's Ledger for the details.

### Added (#192)
- **Make your own vendor search:** Build panel → Notes → Search strings → **Make your own**: pick linked sockets and colours, movement speed, life, resistances, +1 gems, added physical damage or your own text, choose any / all, and Orbhoarder writes the search (checks the game's 50-character limit). Save it with a name and give it a hotkey that types it into the stash or vendor search.

### Changed (#192)
- **Stash search widget merged into Search strings:** your Stash search entries (and their hotkeys) moved to Build panel → Notes → **My search strings**; the separate Stash search widget is gone. Its example entries were left out.

### Changed (#191)
- **Item search folded into Market search:** the Item search icon is gone from the overlay menu; Market search now shows the poe.ninja price next to each suggestion as you type, and still finds who sells it.

### Changed (#190)
- **One checklist:** Help → League start is gone; its list is now the top part of Cheat sheets → **Checklist** (was Progress), followed by the endgame goals. Ticks you already made in either list are kept, per league.

### Changed (#189)
- **Stopwatch moved into This session:** the separate Stopwatch widget is gone (it did the same as part of This session). This session now has a stopwatch you start, pause and reset yourself, next to its automatic map timer. Existing Stopwatch widgets and their hotkeys are removed.

### Added (#188)
- **One window for all pinned panels (test):** Settings → Panels → Show while playing → "One window for all pinned panels". All pinned panels share one see-through window over the game instead of one window each (less memory with several pinned). Clicks outside a panel go to the game; per-panel "clicks go through" still works; drag, resize, hotkeys and Alt-to-hide work as before. Off by default while it is tested on Windows.

### Changed (#187)
- **Game switch hidden for now:** the PoE2 switch from #186 is not shown in Settings until PoE2 mode does more (the code stays). If PoE2 was already picked, the switch still shows so you can go back to PoE1.

### Added (#186)
- **Game switch (PoE2 mode, part 1):** Settings → General → Game: Path of Exile 1 or 2. In PoE2 mode Orbhoarder looks for the PoE2 window, Client.txt (from the running game too) and `poe2_production_Config.ini`, and lists PoE2 trade leagues; each game remembers its own league, and the default window title follows the switch. Price check, Path of Building and poe.ninja prices stay PoE1 only for now (the price check says so in PoE2 mode). PoE1 is unchanged.

### Fixed (#185)
- **Map price check in 3.30:** maps now show **Atlas Drops** instead of Item Quantity; the price check reads it again and uses it as the quantity filter (same values, GGG renamed it).

### Changed (#184)
- **Lighter pinned panels:** a pinned panel's window is now only made when you first open the panel, and is closed again 2 minutes after you close the panel with its hotkey (less memory and CPU when many panels are pinned). Trade companion, Market history (price alerts) and This session stay loaded so they keep working in the background.

### Added (#183)
- **Compare builds** (Orbhoarder window → Build gear → scales button): pick two builds from your folder or a friend's and see what's different: stats (DPS, life, EHP, resistances…), gear mods per slot, gems added, removed or levelled, and passives only in one of them. Reads the build files; nothing is changed.

### Added (#182)
- **Covens (3.30) cheat sheet** with a switch for **Levelling**, **Mapping profit** and **Bosses**: rituals and Fates, the Wickerman and Viscera, Grim Fates and the road to the Coven Queen, and what to do in each case. The choice is remembered.

### Changed (#181)
- **Up to date for 3.30 Covens of Umbra:** the Map mechanics cheat sheet now covers Threads of Creation (Scarabs are gone), Shaped Regions, the new atlas tree and the 3.30 changes to Delirium, Legion, Essence, Ritual, Expedition, Ultimatum, Harvest, Incursion and Mirage. Endgame bosses lists the new atlas points, Thread drops from altars and the Coven Queen; Progress gets the Coven Queen and Shaped Regions. Cost per map now says threads instead of scarabs and sextants, and the currency counter shows Cartographer's Chisel instead of Awakened Sextant.

### Changed (#180)
- **Automatic tests before releases:** every change is now tested (map profit, money tools, backups, search strings, the phone key) and type-checked and built before it can reach a test build.

### Added (#179)
- **Settings → Tools** (overlay settings and the Orbhoarder window's Settings):
  - **Health check:** one button checks the game log and game settings files, Path of Building, your GitHub sign-in, whether poe.ninja and GitHub can be reached, the app's port, updates, and hotkeys used twice, with what to do for each problem.
  - **Settings backup:** save all settings, hotkeys, panel layouts, notes, ticks and session data to one file, and restore it on a new PC or a friend's (no sign-ins or passwords in it).
  - **Phone or other devices:** turn it on, restart, and open the Orbhoarder window in your phone's browser on the same Wi-Fi with the link shown (it has a key; **New key** makes old links stop working).

### Added (#178)
- **Find an upgrade** (Build panel, gear: the ↑ button next to **Trade**): searches the trade site for any base of the same kind with at least your item's values on its main stats (life, resistances, …).
- **More search strings** (Build panel → Notes): flasks that remove bleed/freeze/shock/ignite/poison, flasks with quality, rings/amulets/belts with life, all elemental resistances, jewels with life.
- **Cheat sheets:** **Endgame bosses** (how to reach each pinnacle boss and what usually kills you) and **Map mechanics** (Breach, Legion, Delirium, Essence, Ritual, Expedition, Ultimatum, Blight, Harvest in one line each).
- **Progress** (Cheat sheets → Progress): tick off labs, voidstones, pinnacle bosses and character goals; saved per league.

### Added (#177)
- **Money tools** panel (overlay, in game, Orbhoarder window and the All tab; its own hotkey in Settings → Hotkeys):
  - **Gem levelling:** what a gem costs at level 1 and sells for at level 20 on poe.ninja, best profit first (tick **20% quality** for 1/20 → 20/20). Corrupted gems are left out.
  - **Currency counter:** type how many of each currency you have and see the total in chaos and divine at today's prices. Add other items (scarabs, fossils, essences…) by name.
- **Price alerts** in Market history: the **Alert** button on a starred item tells you (a Windows notification) when its price moves 10%, 20% or 50%.

### Added (#176)
- **Map profit:** the **This session** panel has **Loot** buttons (+5c, +20c, +50c, +1 div, or type an amount) for the map you're in (or the last one), and a **Cost/map** box. It shows profit per hour of map time, and each map's loot in **Last maps**.
- **Last session summary:** when a new session starts (after 2 hours without playing, or **New session**), the old one is kept as a short summary in the panel: time played, maps, deaths, trades, profit, levels gained, where the time went and league mechanics.
- **Deaths per act** in the act splits (Levelling → Next steps → **Campaign time**).

### Added (#175)
- **Bug / Idea button** at the top right of the Orbhoarder window: report a bug or suggest a feature in a few lines. It's sent to the group's builds repo on GitHub with your build-sync sign-in (bug reports can include the last log lines, without your Windows user name or passwords). Not signed in? **Open on GitHub** opens it as a new issue in your browser.

### Security (#174)
- **Other devices need a key with --listen:** when Orbhoarder is started with `--listen` (so another device on your network can open it), that device must now open the link with its key once (`?key=…`); without it, it's refused. Your own PC isn't affected.
- **Problem reports no longer contain your Path of Building settings** (folder paths, player name): the log only says whether each setting is the default or your own.

### Security (#173)
- **Every installer comes with a signed build record** showing it was built by this project's release workflow from this repo, so a download can be checked. Stable releases can only be built from the master branch; work goes to a dev branch and test builds first.

## [1.0.89] - 2026-11-15

### Security (#171)
Orbhoarder's Path of Building now comes from an approved version of the PoB fork instead of whatever is newest, so a change there only reaches players after it's approved here.

### Changed (#170)
Lighter and safer: the Orbhoarder window's moving background pauses while you play; quick price checks only calculate the newest item in Path of Building; the debug log no longer grows forever; reading your game log uses less memory. The overlay's built-in browser now has its own sign-in (sign in once more there), key logging (debug) only records keys while the game is active, and the app's local server refuses requests from other websites.

### Removed (#169)
Leftovers from the original app: the Patreon button and patron names, the Discord links in About, and the old help website. The credit to Awakened PoE Trade (MIT licence) stays in About.

### Changed (#168)
Settings sorted by topic: all panel hotkeys are under **Hotkeys**; startup, windows, updates and problem reports under **General**; a new **Panels** page has where panels show, pinning over the game, chat buttons and the trade site tab; **Path of Building** only has PoB things. Your settings stay as they were.

### Fixed (#167)
Passive tree: a notable further along the path no longer shows as taken before you allocate it.

### Fixed (#166)
Gems → For my level shows the gems again (it stayed empty below the level since the gem stages update).

### Added (#165)
- **Themes show in the Orbhoarder window:** **Glass panels** (on by default) make the panels see-through and lightly blurred, with an accent line on top and the theme's pattern in the corner, so the background shows. **Decoration strength** sets how visible the patterns are. The top bar takes the theme's colour.

### Added (#162)
- **Animations** (Settings → Appearance → **Animations**: Full, Subtle or Off): panels and tabs ease in, new rows slide in, buttons react when you hover and click, loading text shimmers, and theme backgrounds drift slowly in the Orbhoarder window (snow falls, leaves blow, sparkles rise). Windows' "reduce motion" setting turns them off.

### Changed (#161)
- **New logo:** a goblin hoarding glowing orbs, made for Orbhoarder. It replaces the old icon (app, tray, taskbar, installer) and the game's orb picture on About, the update notice and the loading animation.

### Changed (#159)
- **Loot Goblin is now Orbhoarder.** "Loot Goblin" turned out to be someone else's trademark. Windows, tray, settings, the Start menu shortcut and the installer use the new name. Your settings, builds and Path of Building stay where they are (the folders keep the old name), and updates keep working.

### Changed (#157)
- **Gems follow your build's own stages:** if the build's skill list in Path of Building has groups labelled with level ranges (like "1-27 Rolling Magma", "28-31 Firestorm", "31+ Storm Burst") separated by lines, Gems → For my level shows which stage you're in, only that stage's gems under Socket now, the earlier stages' gems under Take out, and what changes at the next stage's level.

### Fixed (#160)
- **The tree map fell behind** when you took passives in a different order than its numbers (e.g. several Intelligence passives on another path): taken passives are now followed along the paths you actually allocated.

### Fixed (#158)
- **Passives taken and unspent points are exact after /passives:** type **/passives** in game once and the Next steps panel uses the game's own count (masteries included), plus what you allocate after.

### Fixed (#157)
- **The build panel's Character follows the character you play again**, from the game log (the character levelling up; party members are ignored), and brings back the build you used with it. The Character list shows the characters from the game log.

### Fixed (#156)
- **Hold gem levels faded gems you already use:** a gem is now faded only until you can use it at all (its level-1 requirement), not until you can reach the level to hold it at. Hover still shows both.

### Fixed (#155)
- **The Loot Goblin window comes back after an update:** windows that were open when an update installed open again when Loot Goblin restarts.

### Fixed (#152)
- **What's new in a test version** lists the changes that version brings (they weren't shown before), and opens by itself after a test update.

### Fixed (#151, #154)
- **Masteries you allocate are ticked off:** the levelling plan (Levelling tab's Next steps, tree map) now reads the game log's mastery lines, also when you change a mastery's effect. Use **Rebuild from game log** once for masteries taken earlier.

### Added (#149)
- **Testing updates:** Settings → Path of Building → **Updates** → **Testing** also installs test versions (like 1.0.89-beta.1) before everyone else gets them, then the stable release when it's out. **Stable** (the default) works as before.

### Added (#146)
- **Cheat sheets** panel: short guides for Betrayal, Heist, Delve and Sanctum, plus the vendor recipes. Open it with its own hotkey (Settings → Path of Building), in the overlay, in game or on the All tab.

### Added (#145)
- **League-start checklist** (Help → **League start**): the steps for a new league, from patch notes and picking a build to loot filter, atlas plan and early selling, each with where to do it in Loot Goblin. Ticks are saved per league.

### Added (#144)
- **Act splits:** in the Levelling tab's **Next steps** panel, at the bottom under **From the game log**, click **Campaign time** to see when you reached each act, how long each act took, and your best split from your other characters (green when you're ahead). **Rebuild from game log** fills them in for characters you already played.
- **This session** shows **Where the time went** (the areas you spent the most time in) and levels per hour.

### Added (#143)
- **Lab run checklist:** the Lab tab has a bar above poelab's page to tick off Izaro 1–3 and the treasure key and count darkshrines, with a run timer. Entering Aspirants' Plaza starts a new run; ticking Izaro 3 stops the timer. Nothing is read from poelab.com.

### Added (#142)
- **Open a trade site link in Market search:** paste a pathofexile.com trade search (or bulk exchange) link into the Market search box and press **Open this search** (or Enter); it opens in the Trade site tab. It tells you when the link is for another league.

### Added (#141)
- **Your own chat buttons in the trade companion:** **Your own buttons…** under the whisper list adds up to 8 buttons with your text, for selling, buying or both. Use {name}, {item} and {price} in the text. Like the built-in buttons, each click copies or sends one message.

### Added (#140)
- **Search strings** (Build panel → Notes): copy a stash or vendor search for the build's gems, boots with movement speed, 3/4/5-linked sockets, and maps without the mods your build can't run. One click copies; in game click the search box (or Ctrl+F) and paste. Long lists are split to fit the game's 50-character limit.

### Added (#139)
- **Notes per build** (Build panel → **Notes**): notes and guide text, the **map mods this build can't run** (pick from common ones or type your own) and its **loot filter** (a FilterBlade link or a name). They're saved next to the build, so build sync shares them with friends; friends' notes are read-only.
- **Map check warns** about map mods your active build can't run (red box at the top when you price check a map).
- **Loot filter reminder:** the Build panel shows which loot filter the active build uses, so you remember to switch it in game.

### Added (#138)
- **Seasonal, fun and league themes** (Settings → Appearance): **Seasonal (changes by itself)** picks summer, autumn, winter or spring for today's date (southern hemisphere by default, northern for friends abroad), with holiday themes for a few days: Valentine's, Easter, Halloween, the festive season and New Year. It shows which theme is on and when it changes. **Just for fun:** Loot Goblin, Potato PC, Comic Exile, Vendor Trash and Mirror Tier. **Follow the current league** uses the league's theme (Covens for now; other leagues use your picked theme). Themes in the Loot Goblin window get small background decorations, drawn by us in CSS (can be turned off). No game artwork or logos are used.

## [1.0.88] - 2026-11-15

Released as 1.0.88: the 1.0.87 run was cancelled when GitHub paused Actions on the fork.

### Fixed (#136)
- **About page stuck on "Checking for updates… Please wait":** a window that briefly lost its connection to the app missed the result and kept showing the old state. Windows now get the current update state whenever they (re)connect; a check that gets no answer gives up after 60 s, and a newer check is no longer cut short by an older one finishing. If checking still shows after 20 s, a **Check again** button appears.

### Changed (#134)
- **Gem ticks are easy to tell apart:** gems you've ticked are a green chip with a tick; gems you haven't are a dashed, dimmed outline. Applies to the Next tab's **tick what you have** list and the Build panel's Gems → For my level → **Socket now**. The Next tab's **Missing** label now shows how many.
- **Take out explained:** with one skill set in the build there's nothing to take out, and the hint now says so and names the skill set. For take-out and swap steps, add skill sets in Path of Building named after a level ("Level 12", "Level 30", …).

## [1.0.86] - 2026-11-15

### Fixed (#133)
- **Market Rising, Falling and Outlook were empty in a new league:** poe.ninja only has a day or two of prices at league start, and Loot Goblin needed four. Changes and the week sparkline now show from two days (the column says how many days there are, with a note while the league is new); the 3-day outlook starts once there are four days.

## [1.0.85] - 2026-11-15

### Added (#132)
- **What pays, in the ready-made atlas tree picker:** each content shows what its drops sell for now (average of its 5 dearest drops on poe.ninja; hover for the list), with **Order by what pays** and a link to poe.ninja's atlas trees. It uses the poe.ninja economy prices Loot Goblin already downloads for price checks: no extra requests. It's a guide to what's valuable, not profit per map. Contents whose drops poe.ninja doesn't price (e.g. strongboxes, shrines) show no price.

### Changed (#131)
- **Mastery picks on the passive tree moved to the hover tooltip** ("Build: …") instead of a yellow box on the map, which covered nearby passives.

## [1.0.84] - 2026-11-15

### Added (#130)
- **Optional second Loot Goblin window (for a third screen):** Settings → Path of Building → **Second Loot Goblin window**. Off by default; when on, open it from the tray (**Open second Loot Goblin window**) or tick **Open it when the game starts too**. It has its own tabs, its own All-tab layout and split sizes (starting from the main window's), and remembers its own screen, position and size. In that window, Settings → Appearance → **This window has its own look** gives it its own theme, background and panel opacity. Trade pages, panel hotkeys and the guide's Lab button still go to the main window; the setup guide and What's new only show in the main window.

## [1.0.83] - 2026-11-15

### Added (#129)
- **Lab tab in the Loot Goblin window:** poelab.com (today's labyrinth layouts) opens inside Loot Goblin instead of your browser. The campaign guide's **Today's layout on poelab.com** button (overlay, in-game panel or window) opens the window on this tab without taking focus from the game. The site is shown as-is in its own session, ads included; links to other sites open in your browser (pop-up ads can't flood it). It stays loaded once opened, like the Trade site tab.

### Security (#129)
- In-app site tabs (Trade site, Lab) only hold the page itself to its allowed sites; redirects inside frames on the page (ads, captchas) no longer bounce out to your browser.

## [1.0.82] - 2026-11-15

### Added (#128)
- **Mastery picks written on the passive tree:** under each mastery in the build, the effect to pick (from the levelling tree, else the build), in a small yellow box. Always shown for masteries among the next 5 (cyan border), otherwise once you zoom in a little.

## [1.0.81] - 2026-11-15

### Fixed (#127)
- **Gems → For my level groups gems by link group again:** each group shows its skill (or PoB label) with "link these N", the skill first then its supports, under the gear piece it goes in. Before, gems without a PoB group label each showed on their own. Needs the Path of Building update that installs with it.

## [1.0.80] - 2026-11-15

### Fixed (#126)
- **Passive tree "taken" holes, properly this time:** the tree map now counts everything on the build's path from your class start to a passive you've taken as taken (1.0.79 only filled holes in the current plan's order, not next to passives kept from the previous levelling tree). The Next tab's list follows the map.

### Added (#125)
- **Tick gems as equipped** (Build panel → Gems → For my level): click a gem in **Socket now** to tick it; the header counts how many you have equipped, unticked ones are faded. In **Take out**, gems still ticked stand out in red until you click them once they're out. Ticks are per character and shared with the Next tab's "tick what you have", in every window.

## [1.0.79] - 2026-11-15

### Fixed (#124)
- **Taken passives no longer break when you take or refund an unrelated passive with the same name** (e.g. refunding an off-build +Intelligence node made an Intelligence node in the build's path show as not taken, and "next" pointed back at it). The game log only names passives, so: on the passive tree, a small passive before one you've taken in the plan counts as taken; on the atlas, everything on the build's path from the start to a taken passive counts as taken.

## [1.0.78] - 2026-11-15

### Added (#123)
- **Atlas: next 5 passives** (Atlas tab): the next passives to take in game are numbered 1–5 and coloured cyan on the atlas, following the path to the build's nearest notable you don't have yet (map sustain notables first when it's a tie). Uses what Loot Goblin saw you take (the ticks button sets it if you already have a tree). **next 5** in the toolbar zooms to them; hover lists them in order.

## [1.0.77] - 2026-11-15

### Added (#122)
- **Gems for your level** (Build panel → Gems → **For my level**, the new default; **Whole build** shows the full loadout as before). From your level (game log, or type it in) and the build's levelling skill sets in PoB ("Level 12", "Level 30", …):
  - **Take out:** gems the previous levelling step used that this step doesn't.
  - **Socket now:** gems you can use at your level, by gear piece and link group (new ones in this step underlined).
  - **Coming up:** the next gems by level and what to add / take out at the next step's level.
- Works in the overlay, the in-game Build panel and the Loot Goblin window. Builds with a single skill set show the endgame gems you can already use.

## [1.0.76] - 2026-11-14

### Fixed (#121)
- **Appearance in the Loot Goblin window:** Settings there now has the Appearance page too, and its preview shows in the window.
- **Saving settings in the overlay reaches the other windows straight away** (the Loot Goblin window and in-game panels used to update only after the overlay closed, e.g. when you switched windows). Applies to every setting, not just themes.

## [1.0.75] - 2026-11-14

### Added (#120)
- **Themes and look settings** (Settings → **Appearance**), shown straight away while you change them:
  - **Theme:** Classic (as before), Midnight (modern dark), Wraeclast (warm, PoE style), Abyss (deep purple), High contrast.
  - **Accent colour:** the theme's own, or any colour you pick (highlighted buttons, focused fields, links).
  - **Font** (Fontin Small Caps, Fontin, or System/Segoe UI), **font size** and **corners** (square, normal, round).
  - **Overlay panel opacity:** lower lets the game show through the overlay's panels.
  - **Loot Goblin window background:** the theme's, a colour, or your own picture (with a darken slider), plus **window panel opacity** so the background shows through.
- Applies to the overlay, the in-game panels and the Loot Goblin window. A few drawn things (atlas tree, charts) keep their own colours. Path of Building's own window isn't themed.

### Changed (#119)
- **Weekly data refresh** (GitHub Actions, Wednesdays): regenerates the atlas tree (GGG's official export, newest version), levelling route and quest gems (Exile Leveling, MIT) and opens a PR when anything changed. No more hand updates at league start.

## [1.0.74] - 2026-11-14

### Security (#117)
- **Web pages inside Loot Goblin are locked down further:** the overlay's built-in browser (wiki / trade site) now runs sandboxed with web security on and only opens web links, and pages shown inside the app can't ask for camera, microphone, notifications or location. The app's own windows state Electron's secure settings explicitly.
- **Security baseline** ([SECURITY-BASELINE.md](SECURITY-BASELINE.md)) with automatic checks on every change and weekly: dependency advisories, Electronegativity, OpenSSF Scorecard. The Release workflow no longer pastes the version text into scripts.

### Security (#116)
- **Build tools updated:** Vite 5 → 8, @vitejs/plugin-vue 4 → 6, vue-tsc 2 → 3, TypeScript 5.6 → 5.9, electron-builder 26.9 → 26.18. Clears the high-severity Vite dev-server advisory and the vue-tsc/esbuild ones. No change to what the app does. Remaining npm audit items are lint tools (no fix released yet) and a minimatch ReDoS inside the installer builder; none ship in the app.

## [1.0.73] - 2026-11-14

### Added (#115)
- **Atlas stats panel** (right of the atlas; list button in the atlas toolbar): every stat of the build's passives added up (e.g. 44 small passives → "88% increased Maps found in your Maps"), sorted by what they're about, with a filter. **Build** = the whole atlas build, **Taken** = the part you've taken in game. Click a line to highlight its passives on the atlas. Open by default in the Loot Goblin window, closed in the overlay.
- **Levelling guide, act 2 optional quests** the route skipped: **Einhar's Hunt** (Riverways: capture the beasts, unlocks the Menagerie) and **Safe and Sound** (Dread Thicket off the Northern Forest: claim your hideout, use the Crafting Bench). Hidden when Optional is off; no passive points.

## [1.0.72] - 2026-11-14

### Fixed (#114)
- **Ready-made atlas trees keep map sustain:** with Map sustain ticked, the sustain notables (Shaping the Mountains/Skies/World, Remnants of the Past, Conquered Conquerors, Emerging Realities) go in first, then the content you picked, so several contents no longer push sustain out. "Didn't fit" now lists content and map sustain separately, each name once.

## [1.0.71] - 2026-11-14

### Added (#113)
- **Ready-made atlas trees** (Atlas tab, magic wand): pick the content you farm (Strongboxes, Expedition, Shrines, Essence, Breach, … one or more), Map sustain on or off and the points (up to 150). Loot Goblin takes that content's notables (and multiple-choice notables set to that content) by the shortest path from the start, then map sustain, then small passives with the points left, and says which notables didn't fit. Uses only GGG's official atlas data. The result is a normal atlas build: edit it, copy the link.
- **Atlas builds sync with your builds:** they're saved as files in your builds folder (`<player>/Atlas/<name>.txt`, each holding the pathofexile.com link), so Push uploads them and friends who can see your builds see your atlas builds after Pull (under their name, read-only; Copy makes it yours). Atlas builds you had on this PC move into the folder once. Delete moves the file to Deleted builds like builds.

## [1.0.70] - 2026-11-14

### Changed (#112)
- **Atlas tree panel on the All tab (and in game / overlay) has the full toolbar:** Search atlas and Edit were only on the Atlas tab.

## [1.0.69] - 2026-11-14

### Added (#111)
- **Hotkeys for Market search and the friends' trade board** (Settings → Path of Building; none by default, so they can't clash with the game's keys). Press to open it in the overlay ready to type, press again to close. If the panel is switched off for the overlay (Where panels show), the hotkey opens its tab in the Loot Goblin window.

## [1.0.68] - 2026-11-14

### Fixed (#110)
- **Text fields are easy to see:** search boxes, inputs and dropdowns (atlas search, market search, board, settings, …) now have a dark background and a light outline that turns blue while you type, instead of the panel's own grey. Price check filters keep their look.

## [1.0.67] - 2026-11-14

### Changed (#109)
- **New default All tab layout**: Build, Trade companion and Market history | Levelling | Tree map and Atlas tree (This session moves off; Edit layout → Add panel brings it back). Only new installs and **Reset layout** get it; a layout you arranged yourself stays as it is.

## [1.0.66] - 2026-11-14

### Added (#108)
- **Friends' trade board** (Board tab in the window, overlay menu, All tab → Add panel): three tabs. **Give**: free items for the group; press **Claim** and the poster sees who wants it, with Whisper / Invite buttons. **Sell**: priced items for friends first; **Whisper** sends a buy message. **Wanted**: what someone needs; **I have one** tells them, **Whisper** contacts them.
- **Post** from the window or overlay: paste the item text (Ctrl+C on the item in game) or type a name, set a price for Sell, and the character friends should whisper. Or set the new **Post hovered item to the friends' trade board** hotkey (Settings → Path of Building, none by default) and press it on an item in game.
- Only your group sees it: listings are GitHub issues in the group's private builds repo, posted with your own GitHub sign-in (the same as build sync), so the poster's name can't be faked and only the poster can mark a listing done or remove it. Every chat button sends or copies one message per click; nothing happens by itself. Needs Path of Building fork PR #33 (updates itself).

## [1.0.65] - 2026-11-14

### Fixed (#107)
- **Campaign guide, act 1:** The Way Forward now shows when you get it (The Ledge, from Tarkleigh) and at Prisoner's Gate, instead of only at its act 2 hand-in.
- After killing Brutus the guide tells you to walk on into Prisoner's Gate and take its waypoint before logging out, so the "Waypoint → Prisoner's Gate" step works.

## [1.0.64] - 2026-11-14

### Fixed (#106)
- **Nothing missed while Loot Goblin was closed:** it remembers how far it read the game log, and on start it catches up on levels, passives, atlas passives and session events written meanwhile (an update, a restart). Old trade whispers aren't replayed. No more "Rebuild from log" after an update.
- "Rebuild from log" in the levelling planner no longer resets what's taken on the atlas (the log spans leagues).
- **Campaign guide vendor recipes say what to do and what you get**, e.g. sell white boots + Quicksilver Flask + Orb of Augmentation to any vendor together → magic boots with 10% movement speed (+5% more each time with movement speed boots, up to 30%).

## [1.0.63] - 2026-11-14

### Added (#105)
- **Every window panel now also works in game:** Tree map, Atlas tree, This session, Market history and Market overview can be pinned over the game (Settings → Path of Building → Show while playing) and shown in the overlay (Shift+Space menu), like the guide, trade companion and build panel.
- **Hotkeys for them:** set one per panel in Settings → Path of Building (none by default, so they can't clash with the game's keys). A pinned panel toggles over the game; otherwise the hotkey opens it in the overlay, or the Loot Goblin window's tab if it's switched off there.
- Settings → Where panels show lists the Atlas tree and Market overview too.

## [1.0.62] - 2026-11-14

### Fixed (#104)
- **Settings → About stuck on "Checking for updates":** a check that never got an answer kept that message on screen for good, and every later check waited on it. A check now gives up after 90 seconds and shows **Check again**.
- While an update is downloading or ready to install, checking again keeps showing that (and the **Install now** button) instead of "Checking for updates".
- The error button opened the original app's download page; it now checks again (Release notes links to Loot Goblin's releases).
- Updater messages now go to the app log, so problem reports show why a check failed.

## [1.0.61] - 2026-11-14

### Added (#103)
- **Atlas tab** in the Loot Goblin window (also an All tab panel: Edit layout → Add panel → Atlas tree): the whole atlas passive tree from GGG's official export (3.30.0), with pan, zoom, hover and search.
- **Atlas builds:** add one from a pathofexile.com atlas tree link or code, keep as many as you like, pick the active one, rename, delete, copy its link to share, or open it on pathofexile.com.
- **What you've taken:** atlas passives you allocate in game are ticked from the game log (green = taken, orange = to take). Set the starting point with "I have this whole build" or "I have nothing".
- **Edit:** click a passive to take it with the path to it, or refund it with what hangs off it. Notables with a choice let you pick the effect.

## [1.0.60] - 2026-11-14

### Added (#102)
- **Customisable All tab:** press **Edit layout** (top right of the Loot Goblin window) to arrange the All tab your way. Drag a panel by its bar to move it (drop it on a column's left or right edge for a new column, up to 5), × takes it off, **Add panel** puts it back. Market overview (poe.ninja) and Market search can now go on the All tab too. **Reset layout** goes back to the default. Your current sizes carry over.

### Changed (#102)
- Double-clicking a line between panels evens out just those panels instead of resetting the whole tab.
- Switching a panel back on for the window in Settings → Where panels show puts it back on the All tab if you had taken it off.

## [1.0.59] - 2026-11-14

### Added (#101)
- **Help tab in the Loot Goblin window:** how to use everything (hotkeys, every tab and button, market search, trade site, loadouts, build sharing, campaign guide), an **FAQ**, and **Get a build**: links to popular build guide sites (poe.ninja builds, Maxroll, Mobalytics, poebuilds.cc, pobb.in) and atlas tree guides. The ? on the overlay bar links to it.
- **Setup guide** updated for everything new: "No build yet? Get one" links on the Build step, the Trade site tab and market search on the Trades step, and where to choose where panels show.

### Changed (#101)
- README and in-app tips updated to match the current features.

## [1.0.58] - 2026-11-14

### Changed (#100)
- **All tab layout:** Trades and Market history moved to the left column, under the build panel (drag the lines to resize). The right column now has the tree map and This session, with room for the atlas tree that's coming next.

## [1.0.57] - 2026-11-14

### Fixed (#99)
- **Price check and Trade on a build item did nothing in the Loot Goblin window.** Both now open the item's exact search in the window's Trade site tab, cheapest first. (The full price check window with build impact is still in the overlay over the game.)

## [1.0.56] - 2026-11-14

### Added (#98)
- **Edit loadouts in the Loot Goblin window** (Build tab → pen button):
  - **New loadout** from the one you picked (copies its tree, item set and skill set under one name, e.g. "Level 30"; Path of Building shows them as one loadout).
  - Rename, copy and delete passive trees, item sets and skill sets.
  - Gems of the picked skill set: switch gems and skill groups on or off, change gem level and quality.
  - **Tree map → Edit:** click a passive to take it (with the path to it) or refund it (with what hangs off it). Masteries are still picked in Path of Building.
  - Path of Building makes the changes (the same way as its own buttons) and the build file is saved and synced. The old file is kept in **Build backups** next to your builds folder. Close the build in Path of Building first, or saving there would overwrite these changes.

## [1.0.55] - 2026-11-14

### Fixed (#97)
- **Market search failed with "s.replace is not a function".** Listings with mod data in an unexpected shape are now handled (that part is skipped, the listing still shows), and one odd listing no longer breaks the whole search.

## [1.0.54] - 2026-11-14

### Added (#95)
- **Manage builds in the Loot Goblin window** (Build tab → folder button): rename, move to a folder (new or existing, e.g. `3.30/Witch`), duplicate and delete your builds. The loadout you picked for a build moves with it, and so does the active build.
- **Deleting a build now syncs.** A deleted build is deleted on GitHub too and kept in **Deleted builds** next to your builds folder, so you can get it back. When a friend deletes one of theirs, your copy moves to Deleted builds as well (only if you hadn't changed it). Renames and moves sync the same way. If a lot of builds go missing at once (a moved or emptied folder), nothing is deleted and you get a warning instead.

### Fixed (#96)
- **Campaign guide showed only one reward for quests that give two.** Mercy Mission now shows the flask (item reward) and Nessa's support gem pick, and Breaking Some Eggs shows both gem picks. Picks come before what to buy, so a gem you can take for free is no longer listed as "buy".

### Added (#96)
- **Optional quests in the campaign guide**, marked "optional": A Fixture of Fate (the Library: Golden Pages, then Siosa's gem pick and shop), A Dirty Job (Fetid Pool, 2 respec points), The King's Feast (Utula), Bestel's Epic (Riptide), In Memory of Greust and The Wings of Vastiri, each with its hand-in and reward. The ➕ button at the top of the guide hides or shows them.

## [1.0.53] - 2026-11-14

### Changed (#94)
- **Hold gem levels folds away** (Levelling → Next). Collapsed by default with a count ("27 gems, 9 usable now"); click the header to open it. Open, it's a compact list (name + level to stop at); gems you can't use yet are faded, and hovering shows the details. Your choice is remembered.

### Added (#94)
- **Choose where each panel shows** (Settings → Path of Building → Where panels show): for build, campaign guide, trade companion, market history, market search, tree map and This session, tick **In game**, **Overlay** (Shift+Space) and/or **Loot Goblin window** (All tab). A panel that's in neither In game nor the overlay opens the Loot Goblin window on its tab when you press its hotkey, and the game keeps focus.
- **Trade site tab in the Loot Goblin window.** GGG's official trade site in its own tab, signed in separately from your browser. You sign in on GGG's own page; Loot Goblin never sees your login. Use GGG's own Whisper and Travel to Hideout buttons there. Back / forward / home / bulk exchange buttons on top; it keeps its page while you switch tabs.
- **Trade buttons open in that tab** (price check, build gear panel, market search). Prefer your browser? Settings → Path of Building → turn off "Open Trade buttons in the Loot Goblin window".
- **Market search** (overlay widget menu, magnifier-and-coin icon): type an item name (unique, base type, gem, card…), pick it, and see who's selling, cheapest first. Filters: online sellers or instant buyout, and a max price. Each listing has:
  - **Whisper:** GGG's own buy message for that listing.
  - **Hideout:** `/hideout name`. Works when the seller lets visitors in; most sellers invite you to their party first.
  - **Instant buyout listings:** opens the search in the Trade site tab, where you click GGG's "Travel to Hideout" yourself (needs your trade site sign-in).
  - Whisper and Hideout follow your Chat buttons setting (copy, or send one chat message per click). Nothing is ever sent by itself.

## [1.0.52] - 2026-11-14

### Fixed (#93)
- **Gems tab showed no gems for many levelling builds.** Link groups with no gear piece set in PoB were tucked away under "only for PoB's calculations". They now show in full in a **No slot set in PoB** card at the end (with levels and colours); only groups switched off in PoB stay folded away.

## [1.0.51] - 2026-11-14

### Fixed (#92)
- **Tree map no longer moves on by itself when you level up.** Its "next" passives now follow what you actually allocated (from the game log), like the Next passives list. For a character not followed from level 2, use **Rebuild from game log** in the levelling pane; until then it still guesses from your level.

## [1.0.50] - 2026-11-14

### Added (#90)
- **Market tab, now in two halves** (drag the line to resize): your watchlist on the left, and a poe.ninja market overview on the right:
  - **Prices:** everything poe.ninja prices for your league, most valuable first, with a 7-day mini graph.
  - **Rising / Falling:** the biggest moves over 7 days.
  - **Outlook:** items that climbed steadily all week, and where they'd be in 3 days if the trend holds. It's a projection from the last 7 days to help you plan, not a promise.
  - Filter by group (currency, scarabs, crafting, divination cards, uniques, gems, maps…), search, and a minimum price to hide cheap noise.
  - Star an item in the list to add it to your watchlist; open it on poe.ninja with one click.

## [1.0.49] - 2026-11-14

### Changed (#89)
- Market history: clear **Open on poe.ninja** and **Delete** buttons instead of small icons.

## [1.0.48] - 2026-11-14

### Fixed (#87)
- **Starring an item's poe.ninja price froze the overlay** (you had to restart Loot Goblin). The market history panel kept re-recording the price in a loop.

### Changed (#57)
- Updated Vue (3.5) and vue-i18n (11) under the hood. Nothing should look different.

## [1.0.47] - 2026-11-14

### Added (#86)
- **Use a friend's builds:** with builds shared with you, the build panel has a **Player** dropdown. Pick a player to use their builds (gear, gems, tree, levelling); pick yourself to go back. Their folder is never changed, and logging into one of your characters switches back to your own builds.
- Build sync warns when your folder isn't your GitHub name (private builds need that for Push) and sets it back in one click.

## [1.0.46] - 2026-11-14

### Changed (#85)
- **Private builds are now the default.** Your builds sync to your own private repo (builds-<your GitHub name>), and you get a friend's builds once they approve your **Request access**. Existing installs switch over once with this update; you can still untick **Private builds** in build sync.

## [1.0.45] - 2026-11-14

### Fixed (#84)
- **Guide no longer jumps when you visit another act's town** (e.g. back to Lioneye's Watch from act 2 to hand in a quest). It stays on your step; a town only moves the guide when the route goes there next.
- The session panel's map timer only runs while the Loot Goblin window is shown and you're in a map.

## [1.0.44] - 2026-11-14

### Added (#83)
- **This session panel** (All tab, bottom right; read from the game's log, nothing is sent anywhere):
  - Maps run, time per map (town/hideout trips not counted), average and maps per hour, a live timer for the map you're in, and your last maps.
  - League mechanics met, from the league NPC's voice lines: Bestiary, Incursion, Delve, Betrayal, Blight, Harvest, Delirium, Expedition, Ultimatum, the Envoy, the Maven, Sirus and the Conquerors.
  - Deaths (also per map), trades done, levelling pace (time per level), loading-screen times and disconnects.
  - Hints for slow loading screens, repeated disconnects or dying in many maps.
  - A new session starts by itself after 2 hours without playing, or with **New session**.

## [1.0.43] - 2026-11-14

### Fixed (#82)
- **New players no longer see "No active build: can't read …active.txt".** With no build picked yet, Loot Goblin uses the newest build in your folder (and remembers it). With no builds at all it says how to add one: save a build in Path of Building, or Settings → Path of Building → Copy builds. A renamed or deleted active build is handled the same way.

## [1.0.42] - 2026-11-14

### Added (#81)
- **Resize the panels in the Loot Goblin window:** drag the lines between panels. On the All tab: the three columns, and tree map / trades / market on the right. In the Levelling pane: guide vs. next steps (the guide now starts smaller). Sizes are remembered; double-click a line to reset.

### Changed (#60)
- **Electron 43 → 45.** Clipboard calls are now asynchronous (Electron 44+): item capture (Ctrl+C / price check), chat buttons, Copy buttons and the GitHub sign-in code wait for the clipboard before pressing keys.

## [1.0.41] - 2026-11-14

### Added (#80)
- **Update banner in the Loot Goblin window:** when a new version is downloaded, a green bar says so with **Install now** (Loot Goblin restarts; the game keeps running) and **Later** (it still installs by itself when the game isn't running).

## [1.0.40] - 2026-11-14

### Fixed (#79)
- The setup guide had two top-level elements, which made Vue warn ("Runtime directive used on component with non-element root node") every time the overlay redrew. No visible change.

## [1.0.39] - 2026-11-14

### Added (#78)
- **Hold gem levels:** the Levelling tab lists gems your build keeps below max level (e.g. Clarity at 5 to reserve less) with "stop at level N", from the gem levels in your Path of Building build.
- **Tick the gems you have:** under Gems, "tick what you have" (per character, saved on this PC). Gems you can use at your level but haven't ticked show as **Missing**. The game log has no gem info, so this is manual.
- **Labyrinth panel:** when you enter the lab, the guide shows the lab (Normal / Cruel / Merciless / Eternal) and a **Today's layout on poelab.com** button that opens poelab in your browser. It says "Labyrinth done" after Izaro and closes when you leave.

## [1.0.38] - 2026-11-14

### Changed (#77): easier to read
- **The guide shows what's what:** quests in yellow with a scroll icon, bosses in red with a skull, items and objects in green with a box, places in blue with a pin; plain text is what you do. Each task is a bullet, the current zone is bold, and a small legend sits under the list.
- **Levelling tab sections have proper headers** (small caps with an icon and a line under them): Next passives, Refund, Ascendancy, At level N, Quest gems, Gems, Vendor recipes, From the game log.

## [1.0.37] - 2026-11-14

### Added (#76)
- **The guide follows your build's bandit choice** (Path of Building → Configuration → Bandit quest): kill all three, or help Alira, Kraityn or Oak. Act 2 shows "Bandits: …" at the top and the route for that choice; quest points count 23 instead of 24 when you help a bandit.

## [1.0.36] - 2026-11-14

### Added (#75)
- **Quests worth skipping are marked.** Hand-ins that only give gems your build doesn't use say **skippable**; item rewards say **item reward**; quest items (keys and the like) are never marked, you need those. (In the in-game guide panel, gem-only hand-ins say **gems** – open the Loot Goblin window to see if your build takes one.)
- **Vendor recipes** in the Levelling tab: the useful ones for where you are in the campaign (movement speed boots, weapon damage recipes, +1 spell gem weapon, flask upgrades, chromatic / jeweller's / fusing, chaos resistance, full rare set), with what to sell and what you get. Checked against poedb's recipe list.
- The guide's crafting lines name the bench recipe you pick up there.

### Changed
- "Usable now" is now "Gems in this step usable at level N: x of y · next: <gem> at <level>", so it's clear why it only changes at certain levels.

## [1.0.35] - 2026-11-14

### Added (#74): more from the game log
- **/passives syncs your quests.** Type /passives in game once: the guide ticks exactly the quests listed there and the planner uses that number of quest points.
- **Passives you take are ticked in Next passives** (✓), and the next 5 skip what you already took. Shows unspent points too. Small passives with the same name ("Intelligence") are matched in order, so they can be slightly off.
- **Character stats** in the Levelling tab: deaths (and in this act), campaign time (hover for each act), Kitava's resistance penalty after acts 5 and 10, atlas points.
- **Rebuild from game log** button: reads your whole Client.txt and fills all of the above for every character made since the log started.
- The Loot Goblin window's top bar shows **AFK** when you're AFK in game.
- Fixed: single respec points (not from quests) no longer tick a quest.
- All of it only reads the game's own log file (Client.txt); nothing is sent to the game.

## [1.0.34] - 2026-11-14

### Added (#73)
- **The guide ticks things off from the game log.** When the game says "You have received a Passive Skill Point" (or respec points), the matching quest on the guide gets a ✓. When a boss starts talking (Brutus, Fairgraves, Merveil, …), its kill line gets a ✓. Quest hand-ins themselves aren't in the game log, so quests without a passive or respec reward aren't ticked.
- **Exact quest points in the levelling planner**: for characters followed from level 2, quest points come from those game-log lines instead of the guide's estimate.
- **Settings → Path of Building: Copy builds from another Path of Building**, right under the Path of Building status. Copies the builds of your normal PoB install (found in Documents) or of a folder you pick; originals stay, same-named builds are skipped.

## [1.0.33] - 2026-11-14

### Changed (#72): campaign guide
- **Every quest is in the guide now.** The guide follows a full route for acts 1–10 (from Exile Leveling): each zone lists what to do there — quests to hand in, bosses to kill, quest items to pick up, trials, waypoints, and which way to go (arrows). Waypoint and log-out trips are their own steps.
- **Passive points are shown on the quest**, not the zone: "Hand in The Marooned Mariner **+1 passive**". Respec-only quests say "respec · skippable".
- **In the Loot Goblin window, hand-in lines show your build's gems**: "take Clarity", "buy Flame Dash" (from your Path of Building build and class).
- Going back to town to sell no longer skips ahead in the guide.
- The guide starts from the beginning once after this update; it catches up by itself the next time you enter a zone.

## [1.0.32] - 2026-11-14

### Added (#71)
- **What's new after each update.** The first time you open the Loot Goblin window or the overlay (Shift+Space) after an update, a popup lists what changed since the version you had (this changelog). Shown once per update, in whichever window opens first. **Settings tab → What's new** shows it again. New installs skip it (the setup guide welcomes them).

## [1.0.31] - 2026-11-14

### Changed (#70): first run in the Loot Goblin window
- **A new install opens the Loot Goblin window with the setup guide**, so players can set everything up before starting the game; the overlay and in-game panels use it once they play. If the guide wasn't finished there, the overlay still shows it the first time it opens. Existing installs (guide done) are unchanged.
- **Settings tab → Run setup guide** opens it again in the window (Shift+Space → wand still works in game).

## [1.0.30] - 2026-11-14

### Changed (#69): Loot Goblin window
- **Guide and Next are one Levelling tab.** Campaign guide on top; under it the levelling planner with two new blocks: **Quest gems for this build** (per quest in this act and the next: which reward to *take* for your class and what to *buy* from the vendor afterwards; "All acts" shows the whole campaign) and **At level N** (gems to add and drop when you pass the current levelling tree's level, from the next tree's skill set). Quest/vendor data: Exile Leveling's game-data export (MIT, HeartofPhos), regenerated each league with `tools/gen-quest-gems.py`.
- **All tab:** build | levelling | tree map, trades, market. The tree map there shows the levelling plan: green = taken by now, cyan with numbers = next 5, orange = later in this tree, and zooms in on the next passives (crosshair button zooms back).
- **Tree map is brighter**: lighter background, unallocated nodes and links easier to see.
- Needs Path of Building with PoB fork PR #26 (`keptIds`, next step's gems).

## [1.0.29] - 2026-11-14

### Added (#68)
- **Settings in the Loot Goblin window.** New **Settings** tab with the same pages as Shift+Space → Settings (Path of Building first). Save applies to every window straight away; Cancel undoes unsaved changes. If settings change in another window while you're editing, you get a note.
- **Next on the All tab.** The levelling planner now also sits in the All grid (top right, next to the guide).

## [1.0.28] - 2026-11-14

### Added (#67)
- **Levelling planner: "Next" tab in the Loot Goblin window.** Shows the next 5 passives to take (or the whole order), the levelling tree you're on, passives to refund when you switch trees, new ascendancy notables, and gems: new in this step, coming up (with the level they need) and usable now. Uses trees named after a level in Path of Building ("Level 12", "Leveling lvl 30", "Lv. 60"; the loadout picked in the Build tab is the end goal). Level comes from Client.txt ("is now level", recorded by the overlay; party members' level-ups too, so pick your character if needed) or can be typed in; quest points come from the campaign guide or can be typed in. Points = level − 1 + quest points. No character data is fetched (GGG rules). Needs Path of Building with the `plan` command (PoB fork PR #25).

## [1.0.27] - 2026-11-14

### Added (#66)
- **Campaign guide shows quest passive points.** Zones where a quest gives passive skill points get a yellow **+1 passive** tag (hover: quest name, respec points, who to hand it in to); respec-only quests are marked **respec · skippable**. A line under the list counts quest points passed so far (24 on the route, one of them for killing all three bandits). Added act 10's Control Blocks (Vilenta). Fixed: act 6's Twilight Strand (Lilly) gives respec points only, not a passive point. Checked against poedb, poewiki and mobalytics quest lists.

## [1.0.26] - 2026-11-14

### Changed (#65)
- **Trade whispers are shared between windows.** Sold or ✕ in the Loot Goblin window closes the trade in the HUD too (and the other way round), and a window opened later still shows the open trades. Open trades older than 3 hours drop off.

### Changed (#64): GGG rules
- "Not affiliated with Grinding Gear Games" now also shows in the app (Settings → About, the setup guide's last step, the Loot Goblin window), not only in the README.
- Requests the app makes to pathofexile.com, poe.ninja and poeprices now say who they come from: the User-Agent ends in `LootGoblin/<version> (+github link)`.

## [1.0.25] - 2026-11-14

### Changed (#63)
- **Open the Loot Goblin window when the game starts** (was: when Loot Goblin starts). Opens without taking focus, once per game launch; if you close it while playing it stays closed until the next launch. Turning it on while the game runs opens it right away. Same setting, so it stays ticked.

## [1.0.24] - 2026-11-14

### Removed (#62): GGG rules
- **Stash tracker removed.** It needed your POESESSID login cookie, which GGG's rules don't allow in shared apps. The saved (encrypted) session and stash snapshot are deleted on start. Use PoE Overlay (a registered GGG app) for stash tracking.
- **Live character comparison turned off**: equipped gear, the character's tree/gems/level, following the character you play and the character list. They used pathofexile.com's character-window pages, which aren't part of GGG's official API. Build impact, gems, tree and the tree map compare with your PoB build only. Can return through GGG's official API if app registration reopens.

## [1.0.23] - 2026-11-14

### Added (#61)
- **Tree map in the Loot Goblin window.** Build → **Tree map** tab draws the whole passive tree for the build and loadout picked above: green = you have it, orange = to take, purple = on your character but not in the build (yellow when no character is compared). Drag to pan, wheel to zoom, double-click or ⛶ to fit, hover for the node's stats and mastery effects, search box highlights nodes by name or stat. Only the build's (and your character's) ascendancy is drawn; cluster jewel nodes are counted, not drawn. Needs the PoB fork with the `treeMap` command.

## [1.0.22] - 2026-11-14

### Added (#59)
- **Loot Goblin window for a second screen.** A normal window with every panel in one place: build (gear / gems / tree, build and loadout pickers, sync, import), campaign guide, trades + ledger, market history and stash tracker. Tabs for each panel or **All** at once. Open it from the tray (double-click the icon, or **Open Loot Goblin window**), by starting Loot Goblin again from the Start menu while it runs, or automatically (Settings → Path of Building → **Open the Loot Goblin window when it starts**; from 1.0.25: when the game starts). Remembers its screen, position, size and tab; if that screen is gone it opens on the main one. Panels follow the game live like the overlay; Trade and price check from the build panel open in the overlay.
- Guide step, trade ledger and market watchlist stay in step between the overlay, HUD and the desktop window (a trade is logged once).

## [1.0.21] - 2026-11-14

### Fixed (#58)
- **Trade ledger, campaign guide progress and market watchlist now survive a restart.** The installed app's local server used a new random port on every start, and the panels' saved data is tied to the port, so it started empty each time. It now uses a fixed port (47284, this PC only); if that's taken it falls back to a random one for that run. Data from earlier runs can't be recovered.

## [1.0.20] - 2026-11-14

### Security (#55)
- Electron 40 → **43.8.10** (clears the high-severity Electron advisories for ≤42.11.15). Electron 44's async clipboard rewrite and 45's safeStorage change are a later step. Dev runs: Electron now downloads its binary on the first `npm run dev` instead of during `npm ci`.
- Dev runs show version **0.0.0-dev** instead of upstream's 3.29.108 (releases still get their version from the Release workflow).

## [1.0.19] - 2026-11-14

### Added (#49)
- **Private builds (per player)** in the build sync box (needs the PoB fork's per-player repos): each player's builds live in their own private repo; **Request access** opens the GitHub form to ask a player to share theirs. Off by default until the group has switched.

### Security (#48)
- **No secrets in problem reports.** GitHub tokens, Authorization headers, POESESSID cookies and token/password values are blanked out of the error text, stack and log lines before a report is sent (home folder was already removed).
- **Safer build imports.** Links only download from the supported build sites over https, also after redirects; 15 s timeout and 2 MB limit; a PoB code that unpacks to more than 32 MB is refused (protects against "zip bomb" codes).
- Clipboard writes from the overlay pages are plain text up to 100 KB.
- Path of Building fork (PoB PRs #21, #22; installed copies update PoB on their own): Pull only writes safe build paths inside the builds folder (a crafted file name in the repo could otherwise write anywhere on the PC), https-only sync with size caps; per-player repo support.

## [1.0.18] - 2026-11-13

### Added (#47)
- **Start Loot Goblin with Windows** (Settings → Path of Building, and the setup guide's extras step). On by default: Loot Goblin starts in the tray when you sign in to Windows. Installed app only.

## [1.0.17] - 2026-11-13

### Fixed (#46)
- **Updates install without clicking through the installer.** The installer is the step-by-step kind, so an update opened the whole wizard and waited for Next. Updates now install silently (notice first), then Loot Goblin starts again by itself.

## [1.0.16] - 2026-11-13

### Security (#45)
- **Local server only answers Loot Goblin's own pages.** It already listened only on this PC, but a web page open in your browser (or a DNS-rebinding page) could connect to its WebSocket and send overlay commands (chat, build push, problem reports, clipboard). Now the Host must be this PC's loopback address (or the host given with `--listen`) and browser requests must come from the overlay's own address. Refused attempts are logged.
- Files served from URLs (app pages, `/uploads`) can't leave their folder; missing files answer 404 instead of an unhandled stream error.
- Links from pages open in the browser only if they're http(s); the overlay and HUD windows can't navigate away from the overlay's pages; the trade-site `<webview>` gets no preload or Node. The GitHub sign-in page only opens on github.com.
- Update check also runs 90 s after start even if the overlay page never connects, so a broken release can still be replaced automatically.
- Dependencies: electron-updater 6.8.11, ws 8.23.0, electron-builder 26.18 (with its tar / app-builder-lib fixes), esbuild 0.28.2 and other non-breaking audit fixes; AppImage patch regenerated for app-builder-lib 26.18. GitHub Actions in our workflows pinned by commit SHA.

### Changed (#44)
- **Path of Building is no longer inside the installer** (726 MB → overlay only, ~100 MB). On first run Loot Goblin downloads PoB from our PoB fork's `master` branch into `%LOCALAPPDATA%\Loot Goblin\PathOfBuilding`: file by file from PoB's own `manifest.xml`, every file hash-checked, progress bar in the setup guide (and Settings → Path of Building), a notification for people who already finished the guide, **Try again** on failure. After that PoB updates itself with its own updater (Check for Update works in the PoB window); Loot Goblin also checks master at start while the PoB window is closed, so build impact stays current.
- Updating from an older Loot Goblin: the installer moves the old `resources\PathOfBuilding` to the new folder first, so only changed files download (full download if that wasn't possible). A PoB-folder setting pointing at the old place is ignored. Settings, builds and the GitHub sign-in stay where they were.
- Uninstalling removes the downloaded PoB (settings and builds in Documents\Loot Goblin stay).
- Release workflow no longer bundles PoB; PoB is released with the PoB fork's **Release PoB (master)** workflow.

## [1.0.14] - 2026-11-13

### Fixed (#43)
- Updates found sooner: Loot Goblin checks for a new release every 30 minutes and when the PC wakes from sleep or is unlocked (was every 16 hours, so an update released while you were away waited until the app restarted). Installing still waits until the game is closed.

## [1.0.13] - 2026-11-13

### Added (#41)
- Setup guide: **copy builds from an earlier Path of Building** (Documents\Path of Building\Builds, or the build save path in its Settings.xml). Copies into your player folder (or the builds folder), keeps sub folders, never overwrites; uploaded by auto sync when signed in. Main only copies from the folder it found itself.

## [1.0.12] - 2026-11-13

### Added (#40)
- **First-run setup guide**: opens by itself the first time the overlay is opened (Shift+Space), then only from the wand button on the top bar. Seven skippable steps: build sharing (GitHub sign-in, player folder, **Request access** to POE-Builds), game log + PoB / builds / player folders (shows what was found, Browse…), character (account name with a Check button that reads the public character list once, follow character), panels (hotkeys, pin over the game, clicks go through, solid background, opacity), trade companion buttons (copy / send, auto-hide), extras (market history, problem reports, stash tracker) and a summary. Changes apply right away. Setting flag `pob.setupDone`.

## [1.0.11] - 2026-11-13

### Added (#39)
- **Automatic problem reports**: crashes and code errors (Loot Goblin, overlay pages, the bundled PoB) open a GitHub issue in the private POE-Builds/poe-builds repo with your GitHub sign-in (label `auto-report`; one issue per problem, repeats add a comment; at most 5 per run; Windows user folder removed). Needs PoB fork #18. Setting: Settings → Path of Building → Send problem reports automatically (on).
- Tray **Report a problem…** opens a new issue in POE-Builds/poe-builds with the version filled in.

## [1.0.10] - 2026-11-13

### Fixed (#38)
- Import button missing when the build panel is pinned over the game (HUD). It's there now: while the import box is open, that panel takes the keyboard so you can paste and type; the game gets focus back after Import (or when you click the game).

## [1.0.9] - 2026-11-13

### Changed (#36)
- Gems by gear piece: sockets no longer have to match gem colours (in PoE1 any gem fits any socket now; a socket of the gem's colour only adds 10% quality). Slots show sockets + links needed ("6S · 6L") and a "colour bonus x/y" note instead of "needs 3G more".

## [1.0.8] - 2026-11-13

### Added (#35)
- **Build sharing from the overlay** (cloud button in the build panel): Sign in with GitHub (code is copied, GitHub opens; finishes by itself), Pull / Push / Sync now with progress and results, player folder, Sync automatically. Uses the bundled PoB's sync (`src\SyncServer.lua`), so PoB and Loot Goblin share one sign-in and one sync state. Warns when Loot Goblin reads builds from another folder than PoB syncs.
- Auto sync: Pull when Loot Goblin starts; Push a few seconds after Loot Goblin changes your folder (import, active build).
- **Import a PoB code or link** (import button in the build panel): pobb.in, poe.ninja, pastebin, maxroll, pob.codes, rentry, poedb or the code itself. Pick name and folder, optionally make it the active build. No PoB window needed.
- **Ctrl+P** opens Path of Building (Settings → Path of Building → Open Path of Building hotkey).
- Empty Builds folder / Player settings now follow PoB's build sync (`BuildSync.json`), also for a PoB git clone.

### Fixed (#34)
- Build panel: the Gems tab also showed the Gear list underneath.

## [1.0.7] - 2026-11-13

### Fixed
- Tray **Open Path of Building** said "not found": the PoB repo and the bundled copy name the exe `Path{space}of{space}Building.exe` (#33).

## [1.0.6] - 2026-11-13

### Added
- A downloaded update installs by itself as soon as Path of Exile isn't running (checked once a minute, process list only), then Loot Goblin starts again. While you play it waits; the notification and tray item still let you update right away (#32).
- In-game notice (bottom of the screen) when an update starts downloading and when it's ready, because Windows hides its own notifications while a game runs full screen (#32).

## [1.0.5] - 2026-11-13

No changes (release to test updating from 1.0.4).

## [1.0.4] - 2026-11-12

### Added
- Windows notification when an update starts downloading and when it's ready (click it to restart and update) (#31).
- Tray menu shows **Restart to update to x.y.z** once an update is downloaded (#31).

### Changed
- Updating on quit now shows the installer's progress and starts Loot Goblin again afterwards (upstream installed silently and left it closed) (#31).

## [1.0.3] - 2026-11-12

### Fixed
- Bundled Path of Building takes the player folder from the GitHub sign-in it shares with PoB (PoB fork #16).

## [1.0.2] - 2026-11-12

### Added
- The installer includes the Path of Building fork (`resources\PathOfBuilding`); tray menu **Open Path of Building**. PoB updates come with each Loot Goblin release (PoB's own updater is off in this copy) (#29).
- Empty Path of Building settings now mean defaults: bundled PoB, builds in `Documents\Loot Goblin\Builds`, player from PoB's build sharing (or no player folder). Build impact is on by default for new installs (#29).

### Fixed
- Tree tab: ascendancy names in blue instead of yellow (yellow means "other mastery effect") (#30).
- Switching character (dropdown or in game) now refreshes gear, gems and tree: a fetch still running for the old character is dropped, the first fetch after a switch may come after 5 s instead of 30 s, and the panels ask again by themselves when the rate limit allowed nothing yet (#30).
- HUD panels can't be resized past the game window or screen any more (older oversized panels shrink to fit) (#30).

## [1.0.0] - 2026-11-12

First Loot Goblin release.

### Added
- Windows installer "Loot Goblin", with self-update from this repo's releases (#25, #28).
- Character dropdown in the build panel (#23).
- Tree tab: keystones, ascendancy, notables, masteries and jewel sockets compared with your character (#24).
- **Build impact** in the price check: shows what an item does to your PoB build, compared with the build's gear and with your current character (items, tree, gems and level from the public Characters tab) (#1, #4).
- **Build panel** with Gear and Gems tabs. Copy, Trade and Price check buttons per item; build and loadout picker (#5, #8).
- **Copy** button in the price check, for GGG's in-game market (#5).
- **Gems by gear piece**: one card per slot with socket colours, links and what's missing (#19, #20).
- **Follow the played character**: switches on login, remembers the build per character (#21, #22).
- **Campaign guide** for acts 1–10. It follows Client.txt and only moves forward (#8, #14).
- **Trade companion**: opens on trade whispers; chat buttons copy or send the command (#8, #17).
- **Ledger**, **Market history** and an optional **Stash tracker** (#8).
- **Show while playing**: pinned panels as separate windows over the game that you can drag and resize. Clicks can go through to the game, set per panel. Hotkeys Ctrl+G / Ctrl+H / Ctrl+T (#11–#18).
- Settings → Path of Building: Browse… pickers. Dev runs keep their settings in `config.dev.json` (#6).
- Upstream release check workflow (weekly PR when Awakened PoE Trade releases) (#8).

### Fixed
- Crash when price-checking build items with an Eater/Exarch implicit (#7).
- PoB colour codes and link IDs showing in loadout names (#9).
- PoE crashing while the guide was shown over the game. Pinned panels now use their own small windows (#10, #11).
- Pinned panels showing at the login screen or at game launch (#13, #15).
- Pinned panels no longer accepting clicks after alt-tabbing (#16).
- Guide jumping back to act 1 zones from act 6+ (#14).
- Campaign guide not finding Client.txt when both Steam and standalone PoE are installed (#12).
