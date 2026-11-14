# Changelog

Changes in Loot Goblin compared with [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade). Upstream's own changes are listed in [its releases](https://github.com/SnosMe/awakened-poe-trade/releases).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow the Loot Goblin releases (set when running the Release workflow), not upstream's version numbers.

**How to maintain:** every PR adds a line under **Unreleased**. When you run a release, rename **Unreleased** to the new version and date, and start a new empty **Unreleased** section.

## [Unreleased]

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
