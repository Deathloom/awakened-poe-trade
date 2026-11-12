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
  // PoE account name incl. discriminator, e.g. Deathloom#1234
  accountName: string
  // Character to read equipped gear from
  character: string
  // Use the character's passive tree, level and gems too (not just items)
  liveTreeAndGems: boolean
  // Hotkey that toggles the build gear panel (null = only from the widget menu)
  gearPanelKey: string | null
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
  IpcPobPickFolderResult

export type IpcEventPayload<Name extends IpcEvent['name'], T extends IpcEvent = IpcEvent> =
  T extends { name: Name, payload: infer P } ? P : never

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

interface Event<TName extends string, TPayload = undefined> {
  name: TName
  payload: TPayload
}
