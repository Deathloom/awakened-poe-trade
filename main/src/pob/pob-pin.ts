// Deathloom fork: the Path of Building fork commit Orbhoarder installs and updates to.
// Pinned so a push to the PoB fork's master doesn't reach every player by itself:
// a PR here moves the pin (the "PoB pin" workflow opens one when PoB's master
// changes). Running apps read this file from this repo (stable builds: master,
// test builds x.y.z-beta.N: dev, see pobPinUrl) and fall back to the value built in.
export const POB_PIN = '73764c81fe6b98684bdc14f3549f02261881c7a1'

export const POB_PIN_URL = 'https://raw.githubusercontent.com/Deathloom/awakened-poe-trade/master/main/src/pob/pob-pin.ts'
export const POB_PIN_URL_TESTING = 'https://raw.githubusercontent.com/Deathloom/awakened-poe-trade/dev/main/src/pob/pob-pin.ts'

// test builds follow dev's pin so testers get a new PoB before everyone else
export function pobPinUrl (appVersion: string): string {
  return /-beta\.\d+$/.test(appVersion) ? POB_PIN_URL_TESTING : POB_PIN_URL
}

// the pin from this file's text (the copy on master)
export function parsePobPin (text: string): string | null {
  const m = /POB_PIN = '([0-9a-f]{40})'/.exec(text)
  return m ? m[1] : null
}
