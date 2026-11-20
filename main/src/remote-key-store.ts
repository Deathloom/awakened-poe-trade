// Deathloom fork (F2b): where the phone key is kept. With Windows' own
// encryption (Electron safeStorage = DPAPI, tied to this Windows user) the key
// lives in remote-key.bin; the old plain remote-key.txt is moved over once and
// deleted. Where encryption isn't available (some Linux setups) the plain file
// stays as before. Pure logic: Electron and fs are passed in (tests stub them).

export interface KeyCipher {
  available: () => boolean
  encrypt: (text: string) => Buffer
  decrypt: (data: Buffer) => string
}

export interface KeyFiles {
  read: (name: string) => Buffer | undefined
  write: (name: string, data: Buffer | string) => void
  remove: (name: string) => void
}

export const PLAIN_FILE = 'remote-key.txt'
export const SEALED_FILE = 'remote-key.bin'

export function validKey (text: string | undefined): text is string {
  return typeof text === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(text)
}

// the saved key, or undefined (then a new one is made and saved)
export function loadKey (files: KeyFiles, cipher: KeyCipher): string | undefined {
  const sealedOk = safe(() => cipher.available(), false)
  if (sealedOk) {
    const sealed = files.read(SEALED_FILE)
    if (sealed) {
      const key = safe(() => cipher.decrypt(sealed).trim(), undefined)
      if (validKey(key)) {
        if (files.read(PLAIN_FILE)) safe(() => files.remove(PLAIN_FILE), undefined)
        return key
      }
    }
  }
  const plain = files.read(PLAIN_FILE)?.toString('utf8').trim()
  if (!validKey(plain)) return undefined
  // migrate: keep the same key (the phone's saved link keeps working)
  if (sealedOk) saveKey(files, cipher, plain)
  return plain
}

export function saveKey (files: KeyFiles, cipher: KeyCipher, key: string): void {
  if (safe(() => cipher.available(), false)) {
    const sealed = safe(() => cipher.encrypt(key), undefined)
    if (sealed && safe(() => { files.write(SEALED_FILE, sealed); return true }, false)) {
      safe(() => files.remove(PLAIN_FILE), undefined)
      return
    }
  }
  safe(() => files.write(PLAIN_FILE, key), undefined)
}

function safe<T> (fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}
