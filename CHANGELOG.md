# Changelog

Changes in Loot Goblin compared with [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade). Upstream's own changes are listed in [its releases](https://github.com/SnosMe/awakened-poe-trade/releases).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow the Loot Goblin releases (set when running the Release workflow), not upstream's version numbers.

**How to maintain:** every PR adds a line under **Unreleased**. When you run a release, rename **Unreleased** to the new version and date, and start a new empty **Unreleased** section.

## [Unreleased]

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
