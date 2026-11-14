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
| **Show while playing** | The guide, trade companion and build panel can be pinned over the game as small windows you can drag and resize. You choose per panel whether clicks go through to the game. |

Shift+Space opens the full overlay. Hover the menu icons to see their names and hotkeys, or press **?** for a quick how-to.

## Setting it up

1. Install Loot Goblin. On first run it downloads our [PoB fork](https://github.com/Deathloom/PathOfBuilding) (once, then it keeps itself up to date). Your GitHub account must be a member of POE-Builds.
2. Press Ctrl+G, click the cloud button and **Sign in with GitHub**. Your player folder becomes your GitHub name and everyone's builds are pulled.
   Leave the folder fields in **Settings → Path of Building** empty to use the defaults (Loot Goblin's PoB, `Documents\Loot Goblin\Builds`); **Browse…** sets your own.
3. Optional, in the same settings page: choose which panels show while playing, and set the chat buttons to copy or send.

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
