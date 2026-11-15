// Deathloom fork: your own chat buttons in the trade companion (Settings live in
// the config). Each button is one chat message per click, like the built-in
// ones (copy or send, Settings → Path of Building → Chat buttons).
// Placeholders: {name} the other player, {item}, {price}.

export interface QuickWhisper {
  label: string
  text: string
  // which whispers show it: someone buying from you (sell), you buying (buy), or both
  for: 'sell' | 'buy' | 'both'
}

export const MAX_QUICK = 8
export const MAX_TEXT = 200

export const QUICK_EXAMPLES: QuickWhisper[] = [
  { label: '1 min', text: '@{name} 1 min, finishing a map', for: 'sell' },
  { label: 'Still want?', text: '@{name} still want {item} for {price}?', for: 'sell' },
  { label: 'Price ok?', text: '@{name} would you take less for {item}?', for: 'buy' }
]

// eslint-disable-next-line no-control-regex
const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : ''

export function cleanQuick (list: unknown): QuickWhisper[] {
  if (!Array.isArray(list)) return []
  return list.map(q => ({
    label: clean(q?.label, 20),
    text: clean(q?.text, MAX_TEXT),
    for: (q?.for === 'buy' || q?.for === 'both') ? q.for : 'sell'
  } as QuickWhisper)).filter(q => q.label && q.text).slice(0, MAX_QUICK)
}

// fill in the placeholders; the result is one line
// (values come from someone else's whisper: they can't turn the message into a command)
export function fillQuick (text: string, t: { char: string, item: string, price: string }): string {
  const v = (s: string) => clean(s, 120).replace(/^[/@#%$&]+/, '')
  return clean(text
    .replace(/\{name\}/gi, () => v(t.char))
    .replace(/\{item\}/gi, () => v(t.item))
    .replace(/\{price\}/gi, () => v(t.price)), 300)
}
