import { clipboard, Clipboard } from 'electron'
import type { Logger } from '../RemoteLogger'

const POLL_DELAY = 48
const POLL_LIMIT = 500

// PoE must read clipboard within this timeframe,
// after that we restore clipboard.
// If game lagged for some reason, it will read
// wrong content (= restored clipboard, potentially containing password).
const RESTORE_AFTER = 120

export class HostClipboard {
  private pollPromise?: Promise<string>
  private elapsed = 0
  private shouldRestore = false

  private isRestored = true

  get isPolling () { return this.pollPromise != null }

  constructor (
    private logger: Logger
  ) {}

  updateOptions (restoreClipboard: boolean) {
    this.shouldRestore = restoreClipboard
  }

  async readItemText (): Promise<string> {
    this.elapsed = 0
    if (this.pollPromise) {
      return await this.pollPromise
    }

    // Deathloom fork: Electron 44+ clipboard is async (W3C-style); every call is awaited.
    this.pollPromise = this.pollItemText()
    return await this.pollPromise
  }

  private async pollItemText (): Promise<string> {
    try {
      let textBefore = await clipboard.readText()
      if (isPoeItem(textBefore)) {
        textBefore = ''
        if (process.platform !== 'linux') {
          await clipboard.writeText('')
        } else {
          // workaround KDE's "Prevent empty clipboard" feature
          // see https://github.com/SnosMe/awakened-poe-trade/issues/1790#issuecomment-4062830614
          await clipboard.writeText(`__APT_FORCE_EMPTY_${Date.now()}`)
        }
      } else if (process.platform === 'linux') {
        // workaround bug in Proton 10+ https://github.com/SnosMe/awakened-poe-trade/issues/1846
        await clipboard.writeText(`__APT_FORCE_EMPTY_${Date.now()}`)
      }

      let textAfter = ''
      while (true) {
        await delay(POLL_DELAY)
        textAfter = await clipboard.readText()
        if (isPoeItem(textAfter)) {
          if (this.shouldRestore) {
            await clipboard.writeText(textBefore)
          }
          return textAfter
        }
        this.elapsed += POLL_DELAY
        if (this.elapsed >= POLL_LIMIT) break
      }

      if (this.shouldRestore) {
        await clipboard.writeText(textBefore)
      }
      this.logger.write('warn [ClipboardPoller] No item text found.')
      throw new Error('Reading clipboard timed out')
    } finally {
      this.pollPromise = undefined
    }
  }

  // when `shouldRestore` is false, this function continues
  // to work as a throttler for callback
  restoreShortly (cb: (clipboard: Clipboard) => Promise<void>) {
    // Not only do we not overwrite the clipboard, but we don't exec callback.
    // This throttling helps against disconnects from "Too many actions".
    if (!this.isRestored) {
      return
    }

    this.isRestored = false
    void (async () => {
      let saved: string | undefined
      try {
        saved = await clipboard.readText()
        await cb(clipboard)
      } catch (e) {
        this.logger.write(`error [Clipboard] ${(e as Error).message}`)
      }
      setTimeout(() => {
        void (async () => {
          try {
            if (this.shouldRestore && saved !== undefined) {
              await clipboard.writeText(saved)
            }
          } catch (e) {
            this.logger.write(`error [Clipboard] restore: ${(e as Error).message}`)
          } finally {
            this.isRestored = true
          }
        })()
      }, RESTORE_AFTER)
    })()
  }
}

function delay (ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function isPoeItem (text: string) {
  return LANGUAGE_DETECTOR.find(({ firstLine }) => text.startsWith(firstLine))
}

const LANGUAGE_DETECTOR = [{
  lang: 'en',
  firstLine: 'Item Class: '
}, {
  lang: 'ru',
  firstLine: 'Класс предмета: '
}, {
  lang: 'fr',
  firstLine: 'Classe d\'objet: '
}, {
  lang: 'de',
  firstLine: 'Gegenstandsklasse: '
}, {
  lang: 'pt',
  firstLine: 'Classe do Item: '
}, {
  lang: 'es',
  firstLine: 'Clase de objeto: '
}, {
  lang: 'th',
  firstLine: 'ชนิดไอเทม: '
}, {
  lang: 'ko',
  firstLine: '아이템 종류: '
}, {
  lang: 'cmn-Hant',
  firstLine: '物品種類: '
}, {
  lang: 'cmn-Hans',
  firstLine: '物品类别: '
}]
