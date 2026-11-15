// Deathloom fork: the Path of Building fork commit Orbhoarder installs and updates to.
// Pinned so a push to the PoB fork's master doesn't reach every player by itself:
// a PR here moves the pin (the "PoB pin" workflow opens one when PoB's master
// changes). Running apps read this file from this repo's master
// (POB_PIN_URL) and fall back to the value built in.
export const POB_PIN = '9ed04ddae0c25f02ddca0914337fdebb29a87f05'

export const POB_PIN_URL = 'https://raw.githubusercontent.com/Deathloom/awakened-poe-trade/master/main/src/pob/pob-pin.ts'

export function isPobCommit (ref: unknown): ref is string {
  return typeof ref === 'string' && /^[0-9a-f]{40}$/.test(ref)
}

// the pin from this file's text (the copy on master)
export function parsePobPin (text: string): string | null {
  const m = /POB_PIN = '([0-9a-f]{40})'/.exec(text)
  return m ? m[1] : null
}
