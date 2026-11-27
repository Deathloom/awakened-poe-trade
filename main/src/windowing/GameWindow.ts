import type { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { OverlayController, AttachEvent } from 'electron-overlay-window'

// Deathloom fork (wave 6): fields the patched library adds; typed here so the code
// also type-checks when the patch isn't applied (npm ci --ignore-scripts)
type PatchedAttachEvent = AttachEvent & { titleIndex?: number }
const patched = OverlayController as typeof OverlayController & { supportsMultiTitle?: boolean }

export interface GameWindow {
  on: (event: 'active-change', listener: (isActive: boolean) => void) => this
}
export class GameWindow extends EventEmitter {
  private _isActive = false
  private _isTracking = false
  // Deathloom fork (wave 6): titles watched, and the one attached last
  private _titles: string[] = []
  private _attachedTitle: string | undefined

  get bounds () { return OverlayController.targetBounds }

  get isActive () { return this._isActive }

  get isTracking () { return this._isTracking }
  get titles (): readonly string[] { return this._titles }
  get attachedTitle () { return this._attachedTitle }
  // the native part watches several titles at once (patched Windows build)
  get supportsMultiTitle () { return patched.supportsMultiTitle === true }

  set isActive (active: boolean) {
    if (this.isActive !== active) {
      this._isActive = active
      this.emit('active-change', this._isActive)
    }
  }

  get uiSidebarWidth () {
    // sidebar is 370px at 800x600
    const ratio = 370 / 600
    return Math.round(this.bounds.height * ratio)
  }

  constructor () {
    super()
    // first 'attach' listener, so onAttach callbacks see the new title
    OverlayController.events.on('attach', (e: PatchedAttachEvent) => {
      const i = typeof e.titleIndex === 'number' && e.titleIndex >= 0 ? e.titleIndex : 0
      this._attachedTitle = this._titles[i] ?? this._titles[0]
    })
    OverlayController.events.on('detach', () => { this._attachedTitle = undefined })
  }

  // Deathloom fork (wave 6): several titles only when supportsMultiTitle; the
  // library can be started once, so later calls are ignored
  attach (window: BrowserWindow | undefined, titles: string | readonly string[]) {
    if (!this._isTracking) {
      const list = (typeof titles === 'string' ? [titles] : [...titles]).filter(t => t && !t.includes('\n'))
      this._titles = (list.length > 1 && !this.supportsMultiTitle) ? list.slice(0, 1) : list
      if (!this._titles.length) return
      OverlayController.events.on('focus', () => { this.isActive = true })
      OverlayController.events.on('blur', () => { this.isActive = false })
      OverlayController.attachByTitle(window, this._titles.join('\n'), { hasTitleBarOnMac: true })
      this._isTracking = true
    }
  }

  onAttach (cb: (hasAccess: boolean | undefined, title: string | undefined) => void) {
    OverlayController.events.on('attach', (e: AttachEvent) => {
      cb(e.hasAccess, this._attachedTitle)
    })
  }

  onDetach (cb: () => void) {
    OverlayController.events.on('detach', cb)
  }

  screenshot () {
    return OverlayController.screenshot()
  }
}
