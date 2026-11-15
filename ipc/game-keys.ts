// Deathloom fork: PoE1 default key bindings, to warn when an Orbhoarder hotkey
// would take a key the game uses (Orbhoarder catches the key first, so the
// game never gets it). Players can rebind keys in game, so this is a hint.
// Hotkey strings use the hotkeyToString format ("Ctrl + T").

const POE1_DEFAULT_KEYS: Record<string, string> = {
  Q: 'skill 4', W: 'skill 5', E: 'skill 6', R: 'skill 7', T: 'skill 8',
  'Ctrl + Q': 'skill 9 (second skill bar)',
  'Ctrl + W': 'skill 10 (second skill bar)',
  'Ctrl + E': 'skill 11 (second skill bar)',
  'Ctrl + R': 'skill 12 (second skill bar)',
  'Ctrl + T': 'skill 13 (second skill bar)',
  1: 'flask 1', 2: 'flask 2', 3: 'flask 3', 4: 'flask 4', 5: 'flask 5',
  6: 'temporary skill 1', 7: 'temporary skill 2',
  X: 'weapon swap', D: 'detonate mines',
  I: 'inventory', C: 'character panel', P: 'passive tree', G: 'atlas', U: 'world map',
  H: 'challenges', Y: 'pantheon', N: 'cosmetics', B: 'item shop list', V: 'events',
  'Ctrl + C': 'copy item text (price check needs it)',
  'Ctrl + Alt + C': 'copy item text with mod details',
  'Ctrl + F': 'stash / vendor search',
  'Ctrl + V': 'paste (chat, search)',
  Enter: 'chat',
  Space: 'close panels',
  Tab: 'map overlay'
}

// what the key does in game, or undefined when it is free by default
export function poe1KeyUse (hotkey: string | null | undefined): string | undefined {
  if (!hotkey) return undefined
  return POE1_DEFAULT_KEYS[hotkey]
}
