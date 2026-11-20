// Deathloom fork: the key other devices need when Orbhoarder runs with --listen
// (see request-guard.ts). Random, kept in the app's data folder so a phone's
// saved link keeps working after a restart; "New key" in settings replaces it.
// Stored with Windows' own encryption where available (remote-key-store.ts).

import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { app, safeStorage } from 'electron'
import { loadKey, saveKey, type KeyCipher, type KeyFiles } from './remote-key-store'

let key: string | undefined

function dir (): string {
  return path.join(app.getPath('userData'), 'apt-data')
}

const files: KeyFiles = {
  read: (name) => {
    try { return fs.readFileSync(path.join(dir(), name)) } catch { return undefined }
  },
  write: (name, data) => {
    fs.mkdirSync(dir(), { recursive: true })
    fs.writeFileSync(path.join(dir(), name), data, { mode: 0o600 })
  },
  remove: (name) => { fs.rmSync(path.join(dir(), name), { force: true }) }
}

const cipher: KeyCipher = {
  available: () => safeStorage.isEncryptionAvailable(),
  encrypt: (text) => safeStorage.encryptString(text),
  decrypt: (data) => safeStorage.decryptString(data)
}

export function remoteKey (): string {
  if (key) return key
  const saved = loadKey(files, cipher)
  if (saved) return (key = saved)
  return newRemoteKey()
}

export function newRemoteKey (): string {
  key = randomBytes(24).toString('base64url')
  saveKey(files, cipher, key)
  return key
}
