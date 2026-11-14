export interface HostConfig {
  shortcuts: ShortcutAction[]
  restoreClipboard: boolean
  clientLog: string | null
  gameConfig: string | null
  stashScroll: boolean
  overlayKey: string
  logKeys: boolean
  windowTitle: string
  language: string
  // Deathloom fork: Path of Building build impact
  pob?: PobConfig
}

// Deathloom fork: panels pinned over the game while it has focus
export type HudPanel = 'guide' | 'trades' | 'gear'

export type PanelKey = 'gear' | 'guide' | 'trades' | 'market' | 'search' | 'session' | 'tree'

export interface PanelPlacement {
  overlay?: boolean
  window?: boolean
}

export interface PobHudConfig {
  guide: boolean
  trades: boolean
  gear: boolean
  // Per panel: mouse clicks go through to the game while playing (the panel is read-only then)
  clickThroughPanels: Record<HudPanel, boolean>
  // older single setting (moved into clickThroughPanels)
  clickThrough?: boolean
  // Trade companion closes itself when no trades are left open (a whisper or Ctrl+T opens it)
  autoHideTrades: boolean
  // Solid background instead of a see-through window (try this if the game crashes)
  opaque: boolean
  // 30-100
  opacity: number
  // Top-left corner of each panel's window, in pixels from the game window's top-left corner
  pos: Record<HudPanel, { x: number, y: number }>
  // Size set by dragging a panel's corner (CSS pixels); missing = the panel's default size
  dims?: Partial<Record<HudPanel, { w: number, h: number }>>
  // older single-window position (moved into pos.guide / pos.trades)
  x?: number
  y?: number
}

// Deathloom fork: Path of Building build impact
export interface PobConfig {
  enabled: boolean
  // Path of Building folder that contains `src` and `runtime` (e.g. the git clone)
  pobDir: string
  // Builds folder for this game, e.g. ...\poe-builds\poe1
  buildsDir: string
  // Player folder inside buildsDir; its active.txt names the active build
  player: string
  // Also compare against the character's equipped gear (public Characters tab)
  liveGear: boolean
  // PoE account name incl. discriminator, e.g. YourName#1234
  accountName: string
  // Character to read equipped gear from (used when characterAuto is off,
  // or until the played character is known)
  character: string
  // Follow the character being played (Client.txt + public character list).
  // undefined = on
  characterAuto?: boolean
  // Use the character's passive tree, level and gems too (not just items)
  liveTreeAndGems: boolean
  // Send problem reports (crashes, code errors) as GitHub issues to the builds repo
  // with your GitHub sign-in. undefined = on
  errorReports?: boolean
  // Start Loot Goblin (in the tray) when you sign in to Windows. undefined = on
  startWithWindows?: boolean
  // Hotkey that toggles the build gear panel (null = only from the widget menu)
  gearPanelKey: string | null
  // Hotkeys that toggle the campaign guide / trade companion (pinned or not)
  guideKey: string | null
  tradesKey: string | null
  // Hotkey that opens the Path of Building window
  openPobKey?: string | null
  // set once the Ctrl+P default was applied to an older config
  hotkeysV2?: boolean
  // set once the Ctrl+G / Ctrl+H / Ctrl+T defaults were applied to an older config
  hotkeysV1?: boolean
  // Loadout picked in the build panel, per build file (path relative to the player folder).
  // Only changes what the overlay compares against; the build file is never written.
  loadouts: Record<string, PobLoadoutChoice>
  // Trade companion: 'copy' puts the chat command on the clipboard,
  // 'send' types it into game chat (one command per click)
  chatButtons: 'copy' | 'send'
  // Trade buttons (price check, build gear, market search) open GGG's trade
  // site in the Loot Goblin window's Trade site tab instead of the browser
  // (undefined = on)
  tradeLinksInWindow?: boolean
  // Where each panel shows (undefined = everywhere it can):
  // overlay = in the Shift+Space overlay and its widget menu;
  // window = on the Loot Goblin window's All tab.
  // In game (HUD) stays in hud.guide / hud.trades / hud.gear.
  panels?: Partial<Record<PanelKey, PanelPlacement>>
  // "Show while playing" HUD: a small separate window that stays on top of the
  // game without taking focus (the full-screen overlay hides while you play)
  hud: PobHudConfig
  // Stash tracker (personal, opt-in): reads stash tabs with your POESESSID
  stash: PobStashConfig
  // Open the desktop window (all panels, for a second screen) when the game starts
  // (key name kept from 1.0.22, when it opened with Loot Goblin)
  desktopAtStart?: boolean
  // First-run setup guide was shown (absent = show it the next time the overlay opens)
  setupDone?: boolean
}

export interface PobLoadoutChoice {
  // PoB's named loadout (the dropdown at the top of PoB), or ...
  named?: string
  // ... separate sets (ids as PoB numbers them)
  spec?: number
  itemSet?: number
  skillSet?: number
}

export interface PobStashConfig {
  enabled: boolean
  league: string
  // Stash tab indexes to read (0-based, as the website numbers them)
  tabs: number[]
}

// Build panel: the player's builds and the active build's loadouts
export interface PobBuildList {
  // Paths relative to the player folder, e.g. "3.29\\Witch\\Build.xml"
  builds: string[]
  active: string | null
  // Deathloom fork: players with builds in the builds folder (yours first),
  // whose builds are shown (player) and your own folder (own)
  players?: string[]
  player?: string
  own?: string
}

export interface PobLoadouts {
  trees: Array<{ id: number, title: string }>
  itemSets: Array<{ id: number, title: string }>
  skillSets: Array<{ id: number, title: string }>
  named: string[]
  active: { spec: number, itemSet: number, skillSet: number, named?: string }
}

export interface PobGem {
  name: string
  level?: number
  quality?: number
  enabled: boolean
  support: boolean
  // PoB gem colour: 1 str, 2 dex, 3 int, 4 white
  colour?: number
}

export interface PobSocketGroup {
  index: number
  label?: string
  slot?: string
  // Set when the skill comes from an item, not a socketed gem
  source?: string
  enabled: boolean
  main?: boolean
  fullDPS?: boolean
  gems: PobGem[]
}

// Passive tree tab: nodes that matter in a tree (small passives only counted)
export interface PobTreeNode {
  id: number
  name: string
  type: 'Keystone' | 'Ascendancy' | 'Notable' | 'Mastery' | 'Socket'
  // Mastery: the chosen effect
  effect?: string
  // Notable from a cluster jewel
  cluster?: boolean
}

export interface PobTreeSummary {
  points: number
  ascendancyPoints: number
  className?: string
  ascendancy?: string
  level?: number
  nodes: PobTreeNode[]
}

// Deathloom fork: tree map (desktop window). Layout per tree version:
// node = [id, x, y, kind, group, orbit, name, ascendancy | false, stats]
// kind: 0 normal, 1 notable, 2 keystone, 3 mastery, 4 jewel socket, 5 class start, 6 ascendancy start
export type PobTreeMapNode = [number, number, number, number, number, number, string, string | false, string[]]
export interface PobTreeMapLayout {
  nodes: PobTreeMapNode[]
  groups: Record<string, [number, number]>
  links: Array<[number, number]>
  orbitRadii: number[]
}
// Deathloom fork: levelling planner ("Next" tab of the Loot Goblin window)
export interface PobPlanNode {
  id: number
  name: string
  type: 'Normal' | 'Notable' | 'Keystone' | 'Mastery' | 'Socket' | string
  effect?: string
  stats?: string
}

export interface PobPlanGem {
  name: string
  reqLevel: number
  // the build's gem level, the gem's normal max and the character level that gem level needs
  level?: number
  maxLevel?: number
  levelReq?: number
  support: boolean
  colour?: number
  group?: string
  slot?: string
}

export interface PobPlan {
  level: number
  questPoints: number
  // passive points the character should have: level - 1 + quest points
  available: number
  phases: Array<{ title: string, level?: number }>
  // 1-based index into phases
  phase: number
  className?: string
  ascendancyClass?: string
  // nodes carried over from the previous levelling tree
  kept: number
  keptIds: number[]
  // nodes of order[] that should be taken by now
  taken: number
  order: PobPlanNode[]
  refund: PobPlanNode[]
  ascendancy: Array<{ id: number, name: string }>
  skillSet?: string
  gems: PobPlanGem[]
  previousGems?: PobPlanGem[]
  // the next levelling step's skill set (swap gems when passing this step's level)
  nextGems?: PobPlanGem[]
  nextSkillSet?: string
  // Configuration tab bandit: None (kill all), Oak, Kraityn, Alira
  bandit?: string
}

export interface PobTreeAlloc {
  ids: number[]
  // mastery node id -> chosen effect
  masteries: Record<string, string>
  // allocated nodes on cluster jewels (not on the map)
  clusterNodes: number
  points: number
  ascendancyPoints: number
  className?: string
  ascendancy?: string
  treeVersion?: string
  level?: number
}

// Character of the account (build panel dropdown)
export interface PobCharacterEntry {
  name: string
  league?: string
  class?: string
  level?: number
}

// Socketable item in a PoB item set (gems tab). sockets in game notation: "R-G-B W"
export interface PobSocketedItem {
  slot: string
  name: string
  baseName?: string
  sockets: string
}

// Stash tracker
export interface StashTabInfo {
  index: number
  name: string
  type: string
  colour?: string
}

export interface StashItem {
  id: string
  tab: number
  name: string
  typeLine: string
  baseType: string
  frameType: number
  stackSize?: number
  ilvl?: number
  icon?: string
  x: number
  y: number
  // Game Ctrl+C style text isn't available from the website; these help price it
  gemLevel?: number
  links?: number
  corrupted?: boolean
}

// Build gear panel: one item of the build's active item set
export interface PobGearItem {
  slot: string
  label: string
  group: 'gear' | 'swap' | 'flask' | 'jewel' | 'abyss'
  active?: boolean
  name: string
  title?: string
  baseName: string
  rarity: string
  type: string
  itemLevel?: number
  quality?: number
  corrupted?: boolean
  mods: Array<{
    text: string
    kind: 'enchant' | 'scourge' | 'implicit' | 'explicit' | 'crucible'
    crafted?: boolean
    fractured?: boolean
    unsupported?: boolean
  }>
  // What GGG's in-game market search accepts: unique name or base type
  searchText: string
  // The item in the game's Ctrl+C format
  text: string
}

// How the equipped gear compares to the build's gear, plus what was loaded
export interface PobEquippedInfo {
  character?: string
  class?: string
  level?: number
  league?: string
  items: number
  skipped: string[]
  summary: PobImpactCompare['summary']
  // What came from the character (false: the build's tree/skills were used)
  tree: boolean
  skills: boolean
  nodes?: number
  jewels?: number
  // Main skill used for the character, and whether it's the build's main skill
  mainSkill?: string
  mainSkillMatched?: boolean
  // Why the tree wasn't used although it was asked for
  passivesError?: string
  // Set by the overlay (ms since epoch)
  fetchedAt?: number
}

export interface PobBuildInfo {
  name: string
  className?: string
  ascendancy?: string
  level?: number
  mainSkill?: string
  stats: Record<string, number | undefined>
}

export interface PobImpactCompare {
  header: string
  summary: Array<{ stat: string, label: string, old: number, new: number, diff: number, pct?: number }>
  lines: Array<{ text: string, positive?: boolean, negative?: boolean }>
}

export interface PobImpactResult {
  item: { name: string, rarity: string, baseName: string, type: string }
  compares: PobImpactCompare[]
  lines: Array<{ text: string }>
  // Same comparison against the character's equipped gear (when live gear is on)
  equipped?: {
    compares: PobImpactCompare[]
    lines: Array<{ text: string }>
    info?: PobEquippedInfo
  }
  // Why the equipped comparison is missing (fetch failed, private profile, ...)
  equippedError?: string
}

export interface ShortcutAction {
  shortcut: string
  keepModKeys?: true
  action: {
    type: 'copy-item'
    focusOverlay?: boolean
    target: string
  } | {
    type: 'ocr-text'
    target: 'heist-gems'
  } | {
    type: 'trigger-event'
    target: string
  } | {
    type: 'stash-search'
    text: string
  } | {
    type: 'toggle-overlay'
  } | {
    type: 'paste-in-chat'
    text: string
    send: boolean
  } | {
    type: 'test-only'
  }
}

export type UpdateInfo =
  {
    state: 'initial' | 'checking-for-update'
  } | {
    state: 'update-available'
    version: string
    noDownloadReason: 'not-supported' | 'disabled-by-flag' | null
  } | {
    state: 'update-downloaded'
    version: string
  } | {
    state: 'update-not-available' | 'error'
    checkedAt: number
  }

export interface HostState {
  contents: string | null
  version: string
  updater: UpdateInfo
}

export type IpcEvent =
  // events that have meaning only in Overlay mode:
  IpcOverlayAttached |
  IpcFocusChange |
  IpcVisibility |
  IpcFocusGame |
  IpcHideExclusiveWidget |
  IpcTrackArea |
  // events used by any type of Client:
  IpcSaveConfig |
  IpcUpdaterState |
  IpcGameLog |
  IpcClientIsActive |
  IpcLogEntry |
  IpcHostConfig |
  IpcWidgetAction |
  IpcItemText |
  IpcOcrText |
  IpcConfigChanged |
  IpcUserAction |
  IpcPobImpactRequest |
  IpcPobImpactResult |
  IpcPobGearRequest |
  IpcPobGearResult |
  IpcWriteClipboard |
  IpcPobPickFolderRequest |
  IpcPobPickFolderResult |
  IpcPobDefaultsRequest |
  IpcPobDefaultsResult |
  IpcPobSetupProbeRequest |
  IpcPobSetupProbeResult |
  IpcPobInstallRequest |
  IpcPobInstallState |
  IpcPobCopyBuildsRequest |
  IpcPobCopyBuildsResult |
  IpcPobBuildsRequest |
  IpcPobBuildsResult |
  IpcPobCharacter |
  IpcPobGemsRequest |
  IpcPobGemsResult |
  IpcPobTreeRequest |
  IpcPobTreeResult |
  IpcPobTreeMapRequest |
  IpcPobPlanRequest |
  IpcReadGameLogRequest |
  IpcReadGameLogResult |
  IpcPobPlanResult |
  IpcPobTreeMapResult |
  IpcPobSyncRequest |
  IpcPobSyncState |
  IpcPobImportRequest |
  IpcPobImportResult |
  IpcStashRequest |
  IpcStashResult |
  IpcStashSession |
  IpcHudSize |
  IpcHudDrag |
  IpcHudMoved |
  IpcHudState |
  IpcOpenTradeTab |
  IpcDesktopView |
  IpcHudPanel |
  IpcHudGearAction |
  IpcHudGearActionRelay |
  IpcHudResize |
  IpcHudDims |
  IpcHudTyping |
  IpcReportError

export type IpcEventPayload<Name extends IpcEvent['name'], T extends IpcEvent = IpcEvent> =
  T extends { name: Name, payload: infer P } ? P : never

// Deathloom fork: HUD window ("show while playing")
type IpcHudSize =
  Event<'CLIENT->MAIN::hud-size', {
    panel: HudPanel
    width: number
    height: number
  }>

type IpcHudDrag =
  Event<'CLIENT->MAIN::hud-drag', {
    panel: HudPanel
    phase: 'start' | 'move' | 'end'
    screenX: number
    screenY: number
  }>

type IpcHudMoved =
  Event<'MAIN->CLIENT::hud-moved', {
    panel: HudPanel
    x: number
    y: number
  }>

// Resizing a HUD panel by its corner: main follows the cursor and sends the new size
type IpcHudResize =
  Event<'CLIENT->MAIN::hud-resize', {
    panel: HudPanel
    phase: 'start' | 'end'
    // the panel's current size, as the start size
    w: number
    h: number
  }>

// Deathloom fork: a HUD panel needs the keyboard (import box): the window may take focus until done
type IpcHudTyping =
  Event<'CLIENT->MAIN::hud-typing', {
    panel: HudPanel
    on: boolean
  }>

// Deathloom fork: an error in an overlay page, for the automatic problem report
type IpcReportError =
  Event<'CLIENT->MAIN::report-error', {
    message: string
    stack?: string
    // page / component, e.g. "hud=gear" or the Vue component name
    where?: string
  }>

type IpcHudDims =
  Event<'MAIN->CLIENT::hud-dims', {
    panel: HudPanel
    w: number
    h: number
    // the resize is finished: the overlay saves it
    done: boolean
  }>

type IpcHudState =
  Event<'MAIN->CLIENT::hud-state', {
    // false while the overlay is active (Shift+Space) or the game isn't focused
    playing: boolean
    // pinned panels hidden with their hotkey
    hidden: { guide: boolean, trades: boolean, gear: boolean }
  }>

type IpcHudPanel =
  Event<'CLIENT->MAIN::hud-panel', {
    panel: HudPanel
    visible: boolean
  }>

// Build gear panel in the HUD: actions the overlay carries out
type IpcHudGearAction =
  Event<'CLIENT->MAIN::hud-gear-action', {
    action: 'trade' | 'price-check' | 'loadouts'
    // item text (Ctrl+C format) for trade / price-check
    text?: string
    // new pob.loadouts for 'loadouts' (the overlay saves the settings)
    loadouts?: Record<string, PobLoadoutChoice>
  }>

type IpcHudGearActionRelay =
  Event<'MAIN->CLIENT::hud-gear-action', {
    action: 'trade' | 'price-check' | 'loadouts'
    text?: string
    loadouts?: Record<string, PobLoadoutChoice>
  }>

type IpcOverlayAttached =
  Event<'MAIN->OVERLAY::overlay-attached'>

type IpcFocusChange =
  Event<'MAIN->OVERLAY::focus-change', {
    game: boolean
    overlay: boolean
    usingHotkey: boolean
  }>

type IpcVisibility =
  Event<'MAIN->OVERLAY::visibility', {
    isVisible: boolean
  }>

type IpcFocusGame =
  Event<'OVERLAY->MAIN::focus-game'>

type IpcHideExclusiveWidget =
  Event<'MAIN->OVERLAY::hide-exclusive-widget'>

type IpcTrackArea =
  Event<'OVERLAY->MAIN::track-area', {
    holdKey: string
    closeThreshold: number
    from: { x: number, y: number }
    area: { x: number, y: number, width: number, height: number }
    dpr: number
  }>

type IpcHostConfig =
  Event<'CLIENT->MAIN::update-host-config', HostConfig>

type IpcClientIsActive =
  Event<'CLIENT->MAIN::used-recently', {
    isOverlay: boolean
  }>

type IpcSaveConfig =
  Event<'CLIENT->MAIN::save-config', {
    contents: string
    isTemporary: boolean
  }>

type IpcConfigChanged =
  Event<'MAIN->CLIENT::config-changed', {
    contents: string
  }>

type IpcLogEntry =
  Event<'MAIN->CLIENT::log-entry', {
    message: string
  }>

type IpcWidgetAction =
  Event<'MAIN->CLIENT::widget-action', {
    target: string
  }>

type IpcItemText =
  Event<'MAIN->CLIENT::item-text', {
    target: string
    clipboard: string
    item?: unknown
    position: { x: number, y: number }
    focusOverlay: boolean
  }>

type IpcOcrText =
  Event<'MAIN->CLIENT::ocr-text', {
    target: string
    pressTime: number
    ocrTime: number
    paragraphs: string[]
  }>

type IpcGameLog =
  Event<'MAIN->CLIENT::game-log', {
    lines: string[]
  }>

type IpcUpdaterState =
  Event<'MAIN->CLIENT::updater-state', UpdateInfo>

// Hotkeyable actions are defined in `ShortcutAction`.
// Actions below are triggered by user interaction with the UI.
type IpcUserAction =
  Event<'CLIENT->MAIN::user-action', {
    action: 'check-for-update' | 'update-and-restart' | 'quit'
  } | {
    action: 'stash-search'
    text: string
  } | {
    // Deathloom fork: trade companion button. Focuses the game and sends one
    // chat command (one message per click, GGG's macro rule).
    action: 'chat-command'
    text: string
  } | {
    // Deathloom fork: open a page of GGG's trade site in the Loot Goblin
    // window's Trade site tab (opens the window if needed, without focus)
    action: 'open-trade-tab'
    url: string
  }>

// Deathloom fork: main → Loot Goblin window: show this trade site page
type IpcDesktopView =
  Event<'MAIN->CLIENT::desktop-view', {
    view: string
  }>

type IpcOpenTradeTab =
  Event<'MAIN->CLIENT::open-trade-tab', {
    url: string
  }>

// Deathloom fork: Path of Building build impact
type IpcPobImpactRequest =
  Event<'CLIENT->MAIN::pob-impact', {
    requestId: number
    itemText: string
    // Fetch equipped gear now instead of using the cached copy (still rate-limited)
    refreshGear?: boolean
  }>

type IpcPobImpactResult =
  Event<'MAIN->CLIENT::pob-impact', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    result?: PobImpactResult
  }>

// Deathloom fork: build gear panel (the active build's items)
type IpcPobGearRequest =
  Event<'CLIENT->MAIN::pob-gear', {
    requestId: number
  }>

type IpcPobGearResult =
  Event<'MAIN->CLIENT::pob-gear', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    itemSet?: string
    items?: PobGearItem[]
  }>

// Deathloom fork: put text on the clipboard (Copy buttons). Never sent to the game.
type IpcWriteClipboard =
  Event<'CLIENT->MAIN::write-clipboard', {
    text: string
  }>

// Deathloom fork: native folder picker for the Path of Building settings
type IpcPobPickFolderRequest =
  Event<'CLIENT->MAIN::pob-pick-folder', {
    requestId: number
    title: string
    defaultPath: string
  }>

type IpcPobPickFolderResult =
  Event<'MAIN->CLIENT::pob-pick-folder', {
    requestId: number
    // null when the dialog was cancelled
    path: string | null
  }>

// Deathloom fork: what empty Path of Building settings fall back to
// (bundled PoB, Documents\Loot Goblin\Builds, PoB's build sync player)
type IpcPobDefaultsRequest =
  Event<'CLIENT->MAIN::pob-defaults', {
    requestId: number
  }>

type IpcPobDefaultsResult =
  Event<'MAIN->CLIENT::pob-defaults', {
    requestId: number
    // '' = no default (e.g. no bundled PoB in dev runs)
    pobDir: string
    buildsDir: string
    player: string
  }>

// Deathloom fork: first-run setup guide. What Loot Goblin finds by itself
// (Client.txt, PoB folder, builds, player) and, with an account name, the
// public character list (one get-characters request).
type IpcPobSetupProbeRequest =
  Event<'CLIENT->MAIN::pob-setup-probe', {
    requestId: number
    accountName?: string
  }>

type IpcPobSetupProbeResult =
  Event<'MAIN->CLIENT::pob-setup-probe', {
    requestId: number
    // Client.txt being read right now (null = not found yet; it's found once the game runs)
    clientLog: string | null
    pobDir: string
    // PoB folder in use has runtime\PoBHeadless.exe
    pobOk: boolean
    buildsDir: string
    player: string
    // only when accountName was given
    characters?: Array<{ name: string, league?: string, level?: number, class?: string }>
    charactersError?: string
    // builds of a Path of Building that was installed before (Documents\Path of Building)
    existingPob?: { buildsDir: string, count: number }
  }>

// Deathloom fork: Loot Goblin's own Path of Building (downloaded on first run
// into %LOCALAPPDATA%\Loot Goblin\PathOfBuilding, then kept up to date)
export interface PobInstallState {
  // missing: not downloaded; installing: first download (or finishing a moved copy);
  // checking / updating: looking for / getting a newer version; error: first download failed
  state: 'missing' | 'installing' | 'checking' | 'updating' | 'ready' | 'error'
  dir: string
  version?: string
  // files done / to do, bytes downloaded
  done: number
  total: number
  bytes: number
  message?: string
  error?: string
}

type IpcPobInstallRequest =
  Event<'CLIENT->MAIN::pob-install', {
    // status: just send the state; start: download now / retry; repair: check every file
    op: 'status' | 'start' | 'repair'
  }>

type IpcPobInstallState =
  Event<'MAIN->CLIENT::pob-install-state', PobInstallState>

// Deathloom fork: copy the builds of that earlier PoB install into the player
// folder (main uses the folder it found itself, never a path from the page)
type IpcPobCopyBuildsRequest =
  Event<'CLIENT->MAIN::pob-copy-builds', {
    requestId: number
    // folder picked by the player (default: the earlier PoB install found in Documents)
    source?: string
  }>

type IpcPobCopyBuildsResult =
  Event<'MAIN->CLIENT::pob-copy-builds', {
    requestId: number
    ok: boolean
    error?: string
    copied?: number
    skipped?: number
    target?: string
  }>

// Deathloom fork: build sync from Loot Goblin (runs PoB's src\SyncServer.lua).
// Same sign-in and BuildSync.json as the PoB window.
export interface PobSyncStatus {
  credAvailable: boolean
  signedIn: boolean
  login?: string
  // signed out, but a pasted fine-grained token is saved in PoB
  usingToken: boolean
  // repoPrefix: per-player builds repos ("builds-" = <owner>/builds-<player>); empty or missing = one shared repo
  settings: { owner: string, repo: string, branch: string, root: string, player: string, repoPrefix?: string }
  prefs: { autoSync: boolean, setupAsked: boolean }
  // PoB's build save path (the folder that maps to the repo's poe1 folder)
  buildPath: string
}

export interface PobSyncState {
  // progress text while syncing or signing in, null when idle
  busy: string | null
  status: PobSyncStatus | null
  // why the status couldn't be read (no PoB folder, PoB too old, ...)
  error?: string
  // device flow in progress: enter userCode on verificationUri
  signIn: { userCode: string, verificationUri: string, expiresAt: number } | null
  // last Pull / Push / Sync now (auto = started by Loot Goblin, not a button)
  last: { time: number, title: string, success: boolean, auto: boolean, lines: string[] } | null
  // message from the last sign-in (e.g. account can't see the repo)
  notice?: string
  // Loot Goblin reads builds from another folder than PoB syncs
  mismatch?: string
}

type IpcPobSyncRequest =
  Event<'CLIENT->MAIN::pob-sync', {
    op: 'status' | 'signIn' | 'cancelSignIn' | 'signOut' | 'pull' | 'push' | 'syncNow' | 'configure'
    // configure
    player?: string
    autoSync?: boolean
    // '' = shared repo, 'builds-' = per-player repos (needs PoB with per-player support)
    repoPrefix?: string
  }>

type IpcPobSyncState =
  Event<'MAIN->CLIENT::pob-sync-state', PobSyncState>

// Deathloom fork: import a PoB code or build link into the player folder
export interface PobImportPreview {
  // suggested file name (no .xml)
  name: string
  className?: string
  ascendancy?: string
  level?: number
  mainSkill?: string
  // sub folders of the player folder ('' = the player folder itself)
  folders: string[]
  // site the code came from, or 'code'
  source: string
}

type IpcPobImportRequest =
  Event<'CLIENT->MAIN::pob-import', {
    requestId: number
    // PoB code or a link (pobb.in, pastebin, poe.ninja, maxroll, ...)
    input: string
    // only decode and return a preview
    preview?: boolean
    name?: string
    folder?: string
    setActive?: boolean
    overwrite?: boolean
  }>

type IpcPobImportResult =
  Event<'MAIN->CLIENT::pob-import', {
    requestId: number
    ok: boolean
    error?: string
    // a build with that name already exists (save again with overwrite)
    exists?: boolean
    preview?: PobImportPreview
    // saved file, relative to the player folder
    saved?: string
  }>

// Deathloom fork: build panel. Lists the player's builds and the active
// build's loadouts; optionally sets the active build (writes active.txt) or
// the loadout first.
type IpcPobBuildsRequest =
  Event<'CLIENT->MAIN::pob-builds', {
    requestId: number
    setActive?: string
    setLoadout?: PobLoadoutChoice
    // Character picked in the build panel dropdown
    setCharacter?: string
    // Use another player's builds ('' = your own)
    setPlayer?: string
  }>

type IpcPobBuildsResult =
  Event<'MAIN->CLIENT::pob-builds', {
    requestId: number
    ok: boolean
    error?: string
    list?: PobBuildList
    build?: PobBuildInfo
    loadouts?: PobLoadouts
    // Character the comparison uses right now
    character?: string
    // Cached character list of the account (newest login first)
    characters?: PobCharacterEntry[]
  }>

// Deathloom fork: the played character changed (auto mode). build = the build
// remembered for that character, already written to active.txt
type IpcPobCharacter =
  Event<'MAIN->CLIENT::pob-character', {
    character: string
    build?: string
  }>

// Deathloom fork: gems menu
type IpcPobGemsRequest =
  Event<'CLIENT->MAIN::pob-gems', {
    requestId: number
    refreshGear?: boolean
  }>

type IpcPobGemsResult =
  Event<'MAIN->CLIENT::pob-gems', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    groups?: PobSocketGroup[]
    // The character's socket groups (live gear with gems on)
    live?: PobSocketGroup[]
    // Build / character gear with sockets, per slot
    items?: PobSocketedItem[]
    liveItems?: PobSocketedItem[]
    character?: string
    // Why live gems are missing
    liveError?: string
  }>

// Deathloom fork: passive tree tab
type IpcReadGameLogRequest =
  Event<'CLIENT->MAIN::read-game-log', { requestId: number }>

type IpcReadGameLogResult =
  Event<'MAIN->CLIENT::read-game-log', {
    requestId: number
    ok: boolean
    error?: string
    lines?: string[]
  }>

type IpcPobPlanRequest =
  Event<'CLIENT->MAIN::pob-plan', {
    requestId: number
    level: number
    questPoints: number
  }>

type IpcPobPlanResult =
  Event<'MAIN->CLIENT::pob-plan', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    plan?: PobPlan
  }>

type IpcPobTreeMapRequest =
  Event<'CLIENT->MAIN::pob-tree-map', {
    requestId: number
    refreshGear?: boolean
    // tree version the window already has the layout for
    haveVersion?: string
  }>

type IpcPobTreeMapResult =
  Event<'MAIN->CLIENT::pob-tree-map', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    version?: string
    layout?: PobTreeMapLayout
    alloc?: PobTreeAlloc
    live?: PobTreeAlloc
    character?: string
    liveError?: string
  }>

type IpcPobTreeRequest =
  Event<'CLIENT->MAIN::pob-tree', {
    requestId: number
    refreshGear?: boolean
  }>

type IpcPobTreeResult =
  Event<'MAIN->CLIENT::pob-tree', {
    requestId: number
    ok: boolean
    error?: string
    build?: PobBuildInfo
    tree?: PobTreeSummary
    // The character's tree (live gear with "tree, level and gems" on)
    live?: PobTreeSummary
    character?: string
    liveError?: string
  }>

// Deathloom fork: stash tracker (personal opt-in, POESESSID)
type IpcStashRequest =
  Event<'CLIENT->MAIN::stash', {
    requestId: number
    action: 'tabs' | 'refresh'
  }>

type IpcStashResult =
  Event<'MAIN->CLIENT::stash', {
    requestId: number
    ok: boolean
    error?: string
    tabs?: StashTabInfo[]
    items?: StashItem[]
    // ids of items that weren't there at the previous refresh
    newIds?: string[]
    fetchedAt?: number
    hasSession: boolean
  }>

// Save or forget the POESESSID (stored encrypted with Windows DPAPI via Electron safeStorage)
type IpcStashSession =
  Event<'CLIENT->MAIN::stash-session', {
    sessionId: string | null
  }>

interface Event<TName extends string, TPayload = undefined> {
  name: TName
  payload: TPayload
}
