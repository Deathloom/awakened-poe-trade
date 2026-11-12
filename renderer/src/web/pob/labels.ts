// Deathloom fork: PoB names can carry colour codes (^2, ^xRRGGBB) and a
// loadout link id ({3}); show them like the PoB window does, without the codes.
// cspell:ignore RRGGBB

export function pobText (text: string | undefined | null): string {
  return (text ?? '').replace(/\^x[0-9a-fA-F]{6}/g, '').replace(/\^\d/g, '').trim()
}

// Loadout names without the link id; the raw name is still what PoB gets back
export function pobLoadoutName (text: string): string {
  return pobText(text).replace(/\s*\{[\w,]+\}\s*$/, '').trim() || 'Default'
}
