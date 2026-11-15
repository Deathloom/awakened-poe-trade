// Deathloom fork (idea 7): "Phone or other devices" (Settings → Tools). When on,
// the server listens on the network (port 47284) and other devices need the
// remote key (request-guard.ts). Kept in a small file read before the server
// starts, so it takes effect after a restart. --listen on the command line wins.

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { app } from 'electron'

function file (): string {
  return path.join(app.getPath('userData'), 'apt-data', 'remote-access.json')
}

export function remoteAccessOn (): boolean {
  try {
    return JSON.parse(fs.readFileSync(file(), 'utf8'))?.enabled === true
  } catch { return false }
}

export function setRemoteAccess (enabled: boolean) {
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file(), JSON.stringify({ enabled }), 'utf8')
}

// this PC's addresses on the local network (IPv4, not loopback)
export function lanAddresses (): string[] {
  const out: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address)
    }
  }
  return out
}
