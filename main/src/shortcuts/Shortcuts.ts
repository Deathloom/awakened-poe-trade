import { screen, globalShortcut } from 'electron'
import { uIOhook, UiohookKey, UiohookWheelEvent } from 'uiohook-napi'
import { isModKey, KeyToElectron, mergeTwoHotkeys } from '../../../ipc/KeyToCode'
import { typeInChat, stashSearch } from './text-box'
import { WidgetAreaTracker } from '../windowing/WidgetAreaTracker'
import { HostClipboard } from './HostClipboard'
import { OcrWorker } from '../vision/link-main'
import type { ShortcutAction, HudPanel } from '../../../ipc/types'

// Deathloom fork: Loot Goblin window tab for a panel that's in neither the overlay nor in game
const WINDOW_VIEW: Record<string, string> = {
  gear: 'build', guide: 'levelling', trades: 'trades', search: 'trade', tree: 'build', atlas: 'atlas', session: 'overview', market: 'market', overview: 'market'
}
const EXTRA = new Set(['tree', 'atlas', 'session', 'market', 'overview'])
import type { Logger } from '../RemoteLogger'
import type { HudWindow } from '../windowing/HudWindow'
import type { OverlayWindow } from '../windowing/OverlayWindow'
import type { GameWindow } from '../windowing/GameWindow'
import type { GameConfig } from '../host-files/GameConfig'
import type { ServerEvents } from '../server'

type UiohookKeyT = keyof typeof UiohookKey
const UiohookToName = Object.fromEntries(Object.entries(UiohookKey).map(([k, v]) => ([v, k])))

export class Shortcuts {
  private actions: ShortcutAction[] = []
  private stashScroll = false
  private logKeys = false
  private areaTracker: WidgetAreaTracker
  private clipboard: HostClipboard
  // Deathloom fork: set by main once the HUD window exists
  hud?: HudWindow
  // Deathloom fork: opens the Path of Building window (tray's "Open Path of Building")
  openPob?: () => void

  static async create (
    logger: Logger,
    overlay: OverlayWindow,
    poeWindow: GameWindow,
    gameConfig: GameConfig,
    server: ServerEvents
  ) {
    const ocrWorker = await OcrWorker.create()
    const shortcuts = new Shortcuts(logger, overlay, poeWindow, gameConfig, server, ocrWorker)
    return shortcuts
  }

  private constructor (
    private logger: Logger,
    private overlay: OverlayWindow,
    private poeWindow: GameWindow,
    private gameConfig: GameConfig,
    private server: ServerEvents,
    private ocrWorker: OcrWorker
  ) {
    this.areaTracker = new WidgetAreaTracker(server, overlay)
    this.clipboard = new HostClipboard(logger)

    this.poeWindow.on('active-change', (isActive) => {
      process.nextTick(() => {
        if (isActive === this.poeWindow.isActive) {
          if (isActive) {
            this.register()
          } else {
            this.unregister()
          }
        }
      })
    })

    this.server.onEventAnyClient('CLIENT->MAIN::user-action', (e) => {
      if (e.action === 'stash-search') {
        stashSearch(e.text, this.clipboard, this.overlay)
      } else if (e.action === 'chat-command') {
        // Deathloom fork: trade companion button. Each click sends exactly one
        // chat message/command, like a chat hotkey (GGG's macro rule).
        const text = e.text.trim()
        if (!text || text.includes('\n') || !/^[/@%#$&]/.test(text)) {
          this.logger.write('warn [Shortcuts] chat-command ignored: not a single chat command')
          return
        }
        this.overlay.assertGameActive()
        typeInChat(text, true, this.clipboard)
      }
    })

    uIOhook.on('keydown', (e) => {
      if (!this.logKeys) return
      const pressed = eventToString(e)
      this.logger.write(`debug [Shortcuts] Keydown ${pressed}`)
    })
    uIOhook.on('keyup', (e) => {
      if (!this.logKeys) return
      this.logger.write(`debug [Shortcuts] Keyup ${UiohookToName[e.keycode] || 'not_supported_key'}`)
    })

    uIOhook.on('wheel', (e) => {
      if (!e.ctrlKey || !this.poeWindow.isActive || !this.stashScroll) return

      if (!isStashArea(e, this.poeWindow)) {
        if (e.rotation > 0) {
          uIOhook.keyTap(UiohookKey.ArrowRight)
        } else if (e.rotation < 0) {
          uIOhook.keyTap(UiohookKey.ArrowLeft)
        }
      }
    })
  }

  // Deathloom fork: set by main.ts (panel placement settings + the Loot Goblin window)
  panelOverlayOff?: (panel: string) => boolean
  openWindowView?: (view: string) => void

  updateActions (
    actions: ShortcutAction[],
    stashScroll: boolean,
    logKeys: boolean,
    restoreClipboard: boolean,
    language: string
  ) {
    this.stashScroll = stashScroll
    this.logKeys = logKeys
    this.clipboard.updateOptions(restoreClipboard)
    this.ocrWorker.updateOptions(language)

    const allShortcuts = new Set([
      'Ctrl + C', 'Ctrl + V', 'Ctrl + A',
      'Ctrl + F',
      'Ctrl + Enter',
      'Home', 'Delete', 'Enter',
      'ArrowUp', 'ArrowRight', 'ArrowLeft'
    ])

    for (const action of actions) {
      if (allShortcuts.has(action.shortcut) && action.action.type !== 'test-only') {
        this.logger.write(`error [Shortcuts] Hotkey "${action.shortcut}" reserved by the game will not be registered.`)
      }
    }
    actions = actions.filter(action => !allShortcuts.has(action.shortcut))

    const duplicates = new Set<string>()
    for (const action of actions) {
      if (allShortcuts.has(action.shortcut)) {
        this.logger.write(`error [Shortcuts] It is not possible to use the same hotkey "${action.shortcut}" for multiple actions.`)
        duplicates.add(action.shortcut)
      } else {
        allShortcuts.add(action.shortcut)
      }
    }
    this.actions = actions.filter(action =>
      !duplicates.has(action.shortcut) ||
      action.action.type === 'toggle-overlay')
  }

  private register () {
    for (const entry of this.actions) {
      const isOk = globalShortcut.register(shortcutToElectron(entry.shortcut), () => {
        if (this.logKeys) {
          this.logger.write(`debug [Shortcuts] Action type: ${entry.action.type}`)
        }

        if (entry.keepModKeys) {
          const nonModKey = entry.shortcut.split(' + ').filter(key => !isModKey(key))[0]
          uIOhook.keyToggle(UiohookKey[nonModKey as UiohookKeyT], 'up')
        } else {
          entry.shortcut.split(' + ').reverse().forEach(key => { uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], 'up') })
        }

        if (entry.action.type === 'toggle-overlay') {
          this.areaTracker.removeListeners()
          this.overlay.toggleActiveState()
        } else if (entry.action.type === 'paste-in-chat') {
          typeInChat(entry.action.text, entry.action.send, this.clipboard)
        } else if (entry.action.type === 'trigger-event') {
          // Deathloom fork: Ctrl+P opens Path of Building
          if (entry.action.target === 'open-pob') {
            this.openPob?.()
            return
          }
          this.server.sendEventTo('broadcast', {
            name: 'MAIN->CLIENT::widget-action',
            payload: { target: entry.action.target }
          })
          // Deathloom fork: build gear / campaign guide / trade companion pinned to the HUD window
          // toggle there, without opening the overlay
          // panels added in 1.0.63: target "panel:<panel>" (tree, atlas, session, market, overview)
          const extraPanel = entry.action.target.startsWith('panel:') && EXTRA.has(entry.action.target.slice(6)) ? entry.action.target.slice(6) as HudPanel : null
          const hudPanel: HudPanel | null = entry.action.target === 'campaign-guide' ? 'guide'
            : entry.action.target === 'trade-companion' ? 'trades'
              : entry.action.target === 'pob-gear' ? 'gear' : extraPanel
          if (hudPanel && this.hud?.isPinned(hudPanel)) {
            this.hud.togglePanel(hudPanel)
            return
          }
          // Deathloom fork: panel set to not show in the overlay: the hotkey opens
          // the Loot Goblin window on its tab instead (the game keeps focus)
          const placeKey = hudPanel ?? (entry.action.target === 'market-search' ? 'search' : null)
          if (placeKey && this.panelOverlayOff?.(placeKey)) {
            this.openWindowView?.(WINDOW_VIEW[placeKey] ?? placeKey)
            return
          }
          // Deathloom fork: the build gear panel has buttons, so it needs the overlay focused;
          // unpinned guide / companion only show with the overlay active
          if (entry.action.target === 'pob-gear' || hudPanel) {
            this.areaTracker.removeListeners()
            this.overlay.assertOverlayActive()
          }
        } else if (entry.action.type === 'stash-search') {
          stashSearch(entry.action.text, this.clipboard, this.overlay)
        } else if (entry.action.type === 'copy-item') {
          const { action } = entry

          const pressPosition = screen.getCursorScreenPoint()

          this.clipboard.readItemText()
            .then(clipboard => {
              this.areaTracker.removeListeners()
              this.server.sendEventTo('last-active', {
                name: 'MAIN->CLIENT::item-text',
                payload: { target: action.target, clipboard, position: pressPosition, focusOverlay: Boolean(action.focusOverlay) }
              })
              if (action.focusOverlay && this.overlay.wasUsedRecently) {
                this.overlay.assertOverlayActive()
              }
            }).catch(() => {})

          pressKeysToCopyItemText(
            (entry.keepModKeys) ? entry.shortcut.split(' + ').filter(key => isModKey(key)) : undefined,
            this.gameConfig.showModsKey
          )
        } else if (entry.action.type === 'ocr-text' && entry.action.target === 'heist-gems') {
          if (process.platform !== 'win32') return

          const { action } = entry
          const pressTime = Date.now()
          const imageData = this.poeWindow.screenshot()
          this.ocrWorker.findHeistGems({
            width: this.poeWindow.bounds.width,
            height: this.poeWindow.bounds.height,
            data: imageData
          }).then(result => {
            this.server.sendEventTo('last-active', {
              name: 'MAIN->CLIENT::ocr-text',
              payload: {
                target: action.target,
                pressTime,
                ocrTime: result.elapsed,
                paragraphs: result.recognized.map(p => p.text)
              }
            })
          }).catch(() => {})
        }
      })

      if (!isOk) {
        this.logger.write(`error [Shortcuts] Failed to register a shortcut "${entry.shortcut}". It is already registered by another application.`)
      }

      if (entry.action.type === 'test-only') {
        globalShortcut.unregister(shortcutToElectron(entry.shortcut))
      }
    }
  }

  private unregister () {
    globalShortcut.unregisterAll()
  }
}

function pressKeysToCopyItemText (pressedModKeys: string[] = [], showModsKey: string) {
  // 3.29: Copying an item's text now always copies the advanced description format.
  showModsKey = 'Ctrl'

  let keys = mergeTwoHotkeys('Ctrl + C', showModsKey).split(' + ')
  keys = keys.filter(key => key !== 'C')
  if (process.platform !== 'darwin') {
    // On non-Mac platforms, don't toggle keys that are already being pressed.
    //
    // For unknown reasons, we need to toggle pressed keys on Mac for advanced
    // mod descriptions to be copied. You can test this by setting the shortcut
    // to "Alt + any letter". They'll work with this line, but not if it's
    // commented out.
    keys = keys.filter(key => !pressedModKeys.includes(key))
  }

  for (const key of keys) {
    uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], 'down')
  }

  // finally press `C` to copy text
  uIOhook.keyTap(UiohookKey.C)

  keys.reverse()
  for (const key of keys) {
    uIOhook.keyToggle(UiohookKey[key as UiohookKeyT], 'up')
  }
}

function isStashArea (mouse: UiohookWheelEvent, poeWindow: GameWindow): boolean {
  if (!poeWindow.bounds ||
      mouse.x > (poeWindow.bounds.x + poeWindow.uiSidebarWidth)) return false

  return (mouse.y > (poeWindow.bounds.y + poeWindow.bounds.height * 154 / 1600) &&
          mouse.y < (poeWindow.bounds.y + poeWindow.bounds.height * 1192 / 1600))
}

function eventToString (e: { keycode: number, ctrlKey: boolean, altKey: boolean, shiftKey: boolean }) {
  const { ctrlKey, shiftKey, altKey } = e

  let code = UiohookToName[e.keycode]
  if (!code) return 'not_supported_key'

  if (code === 'Shift' || code === 'Alt' || code === 'Ctrl') return code

  if (ctrlKey && shiftKey && altKey) code = `Ctrl + Shift + Alt + ${code}`
  else if (shiftKey && altKey) code = `Shift + Alt + ${code}`
  else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`
  else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`
  else if (altKey) code = `Alt + ${code}`
  else if (ctrlKey) code = `Ctrl + ${code}`
  else if (shiftKey) code = `Shift + ${code}`

  return code
}

function shortcutToElectron (shortcut: string) {
  return shortcut
    .split(' + ')
    .map(k => KeyToElectron[k as keyof typeof KeyToElectron])
    .join('+')
}
