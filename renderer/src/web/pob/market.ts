// Deathloom fork: helpers for GGG's in-game market (opened with `/` in game).
//
// The market's search box only takes item names and base types (tested
// 2026-11-12), so "Copy" puts the unique name or the base type on the
// clipboard. The player presses `/` and pastes it themselves: the overlay never
// types into the game. Exact stat searches go to the official trade site.

import { ref } from 'vue'
import { Host } from '@/web/background/IPC'
import type { ParsedItem } from '@/parser'

// Text for the in-game market search box. The parser's `info` is the unique
// for identified uniques and the base type for everything else (gems and
// currency: their name), always in the game client's language.
export function marketSearchText (item: ParsedItem): string {
  return item.info.name
}

// Clipboard is written by the main process (works in the overlay and in a browser tab)
export function copyText (text: string) {
  Host.sendEvent({
    name: 'CLIENT->MAIN::write-clipboard',
    payload: { text }
  })
}

// Copy + a short "Copied" state for the button that was pressed
export function useCopyFeedback (ms = 1500) {
  const copiedKey = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function copy (text: string, key = 'default') {
    copyText(text)
    copiedKey.value = key
    clearTimeout(timer)
    timer = setTimeout(() => { copiedKey.value = null }, ms)
  }

  return { copiedKey, copy }
}
