# Loot Goblin

A Path of Exile 1 overlay for a small group of friends. It does price checks and trade searches, compares items against your Path of Building build, and keeps a campaign guide and trade companion on screen while you play.

Loot Goblin is a fork of [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) by SnosMe. It works together with our [Path of Building fork](https://github.com/Deathloom/PathOfBuilding), and builds are shared through the private [POE-Builds/poe-builds](https://github.com/POE-Builds/poe-builds) repo.

> Not affiliated with or endorsed by Grinding Gear Games. Loot Goblin only reads the game's log file and your clipboard, uses the trade site's search like Awakened PoE Trade, and gets prices from poe.ninja. It doesn't read character or stash data from pathofexile.com. It never reads game memory, never buys anything automatically, and only sends a chat command when you click a button.

## Download

Go to [Releases](https://github.com/Deathloom/awakened-poe-trade/releases), download `Loot Goblin Setup x.y.z.exe` and run it. Windows SmartScreen may warn you because the installer isn't signed: click **More info → Run anyway**.

Installed copies update themselves from this repo's releases.

If you already use Awakened PoE Trade or PoE Overlay, close it first, because the hotkeys clash.

## What it does

**Everything Awakened PoE Trade does:** price check (Ctrl+D), trade site search, poe.ninja prices, chat command hotkeys.

**Added in Loot Goblin:**

| Feature | What you get |
|---|---|
| **Build impact** | Price-checking an item shows what it does to your active PoB build: DPS, eHP, life, ES, resistances and attributes. It compares against the build's gear. |
| **Build panel** (Ctrl+G) | Gear, Gems and Tree tabs for the active build. Every item has Copy / Trade / Price check buttons. Gems are shown per gear piece, with socket colours and links. Pick the build, loadout and character from the panel. |
| **Build sharing** | Cloud button in the build panel: sign in with GitHub, Pull / Push / Sync now. Builds sync automatically when Loot Goblin starts and after you change them. Same sign-in as the PoB window. |
| **Import builds** | Import button in the build panel: paste a PoB code or a pobb.in / poe.ninja / pastebin / maxroll link and save it to your folder, without opening PoB. |
| **Open PoB** (Ctrl+P) | Opens Loot Goblin's own Path of Building. |
| **Campaign guide** (Ctrl+H) | Route for acts 1–10. It moves forward as you enter zones. |
| **Trade companion** (Ctrl+T) | Opens on an incoming trade whisper, with Invite / Trade / Thanks / Kick buttons. They copy the command to the clipboard, or send it if you turn that on. |
| **Ledger** | What you sold and bought per currency, per league. |
| **Market history** | 7-day poe.ninja trend, plus prices recorded while the app runs. |
| **Show while playing** | Any panel (guide, trade companion, build, tree map, atlas tree, this session, market history, market overview) can be pinned over the game as a small window you can drag and resize, or shown in the overlay, each with its own hotkey. You choose per panel whether clicks go through to the game. |
| **Loot Goblin window** | A normal window for a second screen with everything in one place: All (arrange it yourself: add, remove, move and resize panels), Build, Levelling, Atlas (atlas tree builds, what you have taken, edit and share), Trades, Board (friends' trade board), Market, Trade site, Help and Settings tabs. Opens from the tray or when the game starts. |
| **Levelling planner** | Campaign guide with quest gems to take or buy for your build, optional quests, gem swaps per level, the next passives to take and a tree map, all from your PoB build and the game log. |
| **Market search** | Find an item by name and see who sells it, cheapest first. **Whisper** (GGG's buy message) and **Hideout** buttons, one chat message per click. |
| **Friends' trade board** | Board tab, overlay menu and All tab: **Give** (free for friends, Claim), **Sell** (priced for friends first, Whisper) and **Wanted** (I have one). Post from the window by pasting item text, or hover an item in game and press your board hotkey. Only your group sees it (GitHub issues in the private builds repo, your own sign-in); every message is one click. |
| **Trade site tab** | GGG's official trade site inside the Loot Goblin window, signed in separately (on GGG's own page; Loot Goblin never sees your login). Trade buttons open there. |
| **Edit loadouts** | In the window: new loadouts, rename / copy / delete trees, item sets and skill sets, gem levels and quality, take or refund passives on the tree map. The old file is kept in `Build backups`. |
| **Manage builds** | Rename, move to folders, duplicate and delete builds. Deletions sync; deleted builds are kept in `Deleted builds`. |
| **Where panels show** | Per panel: in game, in the overlay and/or in the Loot Goblin window. |

Shift+Space opens the full overlay. Hover the menu icons to see their names and hotkeys, or press **?** for a quick how-to. The Loot Goblin window's **Help** tab has the full help, an FAQ and links to build guides.

## Setting it up

1. Install Loot Goblin. On first run it downloads our [PoB fork](https://github.com/Deathloom/PathOfBuilding) (once, then it keeps itself up to date). Your GitHub account must be a member of POE-Builds.
2. Press Ctrl+G, click the cloud button and **Sign in with GitHub**. Your player folder becomes your GitHub name and everyone's builds are pulled.
   Leave the folder fields in **Settings → Path of Building** empty to use the defaults (Loot Goblin's PoB, `Documents\Loot Goblin\Builds`); **Browse…** sets your own.
3. Optional, in the same settings page: choose which panels show while playing, and set the chat buttons to copy or send.

## Don't have a build yet?

Pick a guide, copy its Path of Building code or pobb.in link, and import it with the import button in the build panel.

- [poe.ninja builds](https://poe.ninja/builds): what the top ladder characters play, each with a PoB code
- [Maxroll](https://maxroll.gg/poe): written build guides (league starters, endgame)
- [Mobalytics](https://mobalytics.gg/poe/builds): build guides updated each patch
- [poebuilds.cc](https://www.poebuilds.cc): build guide videos sorted by league, class and skill
- [pobb.in](https://pobb.in): shared Path of Building codes

Atlas trees: [Maxroll atlas passive tree](https://maxroll.gg/poe/getting-started/atlas-passive-tree), [Maxroll atlas progression](https://maxroll.gg/poe/getting-started/atlas-progression-guide), [PoE-Vault atlas tree strategies](https://www.poe-vault.com/guides/atlas-passive-skill-tree-strategies).

## FAQ

**Can I get banned for using it?** Loot Goblin stays inside GGG's rules for third-party tools: it reads the game's log file and your clipboard (never game memory or files), never buys or trades by itself, and sends at most one chat command per click. It doesn't read your pathofexile.com login; the stash tracker and live character comparison were removed for that reason.

**Do I need a GitHub account?** Only to share builds with the group and send problem reports. Everything else works without one.

**Who can see my builds?** Nobody until you approve them: each player has a private builds repo.

**Where are my files?** `Documents\Loot Goblin\Builds` (your player folder inside it), with `Deleted builds` and `Build backups` next to it.

**Whisper / Hideout did nothing in game.** With Chat buttons on "copy", the command is on your clipboard: Enter, Ctrl+V, Enter in game. Set it to "send" for one message per click. `/hideout name` only works when the seller lets visitors in; instant buyout uses GGG's Travel to Hideout on the trade site.

**The game crashes with panels over it.** Use Windowed Fullscreen and try Solid background (Settings → Path of Building). On PoE 3.30, switching the game's renderer from Vulkan to DirectX 12 fixed a crash.

**How do updates work?** Loot Goblin updates itself and installs when the game isn't running (or click Install now in the window). What's new shows the changes.

More in the app: Loot Goblin window → **Help**.

## Changes

See [CHANGELOG.md](./CHANGELOG.md).

## Development

See [DEVELOPING.md](./DEVELOPING.md). In short: `npm ci` and `npm run dev` in `renderer`, then the same in `main` in a second window.

How this fork is kept up to date:

- Fork-only code goes in new files under `fork/` branches wherever possible, so upstream merges stay small.
- The **Upstream release check** workflow runs every Tuesday. It opens a PR in this repo when Awakened PoE Trade has a new release.
- Nothing is ever pushed to the upstream project.
- Every PR adds a line to `CHANGELOG.md` under **Unreleased**.

## Credits and licence

MIT, same as upstream; see [LICENSE](./LICENSE). The original app is © Alexander Drozdov (SnosMe) and the [Awakened PoE Trade contributors](https://github.com/SnosMe/awakened-poe-trade/graphs/contributors).

Also relies on [Path of Building Community](https://github.com/PathOfBuildingCommunity/PathOfBuilding), [libuiohook](https://github.com/kwhat/libuiohook), [RePoE](https://github.com/brather1ng/RePoE), [poeprices.info](https://www.poeprices.info/) and [poe.ninja](https://poe.ninja/).

Game data and images © Grinding Gear Games.
