// Deathloom fork: links from pages (window.open, target=_blank) open in the
// browser only when they are web links. Other schemes (file:, ms-*, custom
// protocol handlers) could start programs, so they're dropped.
import { shell, type WebContents } from 'electron'

export function isWebLink (url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function openWebLink (url: string, onlyHost?: string): void {
  if (!isWebLink(url)) {
    console.warn(`[links] not opened (not a web link): ${url.slice(0, 80)}`)
    return
  }
  if (onlyHost && new URL(url).host !== onlyHost) {
    console.warn(`[links] not opened (expected ${onlyHost}): ${url.slice(0, 80)}`)
    return
  }
  void shell.openExternal(url)
}

// Windows that show the overlay's own pages: links open in the browser, and the
// window itself never navigates away from the overlay (a remote page would get
// the window's privileges and the local server's address)
export function lockToAppPages (contents: WebContents): void {
  contents.setWindowOpenHandler((details) => {
    openWebLink(details.url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    let same = false
    try { same = new URL(url).origin === new URL(contents.getURL()).origin } catch {}
    if (!same) {
      e.preventDefault()
      openWebLink(url)
    }
  })
}
