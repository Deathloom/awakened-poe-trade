// Deathloom fork: the key other devices need when Orbhoarder runs with --listen
// (see request-guard.ts). Random, kept in the app's data folder so a phone's
// saved link keeps working after a restart; "New key" in settings replaces it.

import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { app } from 'electron'

let key: string | undefined

function file (): string {
  return path.join(app.getPath('userData'), 'apt-data', 'remote-key.txt')
}

export function remoteKey (): string {
  if (key) return key
  try {
    const saved = fs.readFileSync(file(), 'utf8').trim()
    if (/^[A-Za-z0-9_-]{32,128}$/.test(saved)) return (key = saved)
  } catch {}
  return newRemoteKey()
}

export function newRemoteKey (): string {
  key = randomBytes(24).toString('base64url')
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true })
    fs.writeFileSync(file(), key, { encoding: 'utf8', mode: 0o600 })
  } catch {}
  return key
}
