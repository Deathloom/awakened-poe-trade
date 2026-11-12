// Deathloom fork: chat buttons (trade companion). Depending on the setting
// the command is copied to the clipboard (paste it in chat yourself) or sent
// by main: it focuses the game and sends exactly one chat message per click,
// like a chat hotkey (GGG's macro rule: one action per key press / click).

import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { copyText } from '@/web/pob/market'

export function chatMode (): 'copy' | 'send' {
  return AppConfig().pob?.chatButtons === 'send' ? 'send' : 'copy'
}

export function runChat (text: string) {
  if (chatMode() === 'send') {
    Host.sendEvent({
      name: 'CLIENT->MAIN::user-action',
      payload: { action: 'chat-command', text }
    })
  } else {
    copyText(text)
  }
}
