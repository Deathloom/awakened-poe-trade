// Deathloom fork: Settings → Tools in main: health check (idea 13), settings
// backup files (idea 14), phone or other devices (idea 7).

import * as fs from 'fs'
import * as path from 'path'
import { app, dialog, net } from 'electron'
import type { HealthItem } from '../../ipc/types'
import { listenInfo } from './server'
import { remoteKey, newRemoteKey } from './remote-key'
import { remoteAccessOn, setRemoteAccess, lanAddresses } from './remote-access'
import { POB_PIN } from './pob/pob-pin'

const STABLE_PORT = 47284
const MAX_BACKUP_BYTES = 5 * 1024 * 1024

export interface HealthDeps {
  clientLog: () => string | null
  gameConfig: () => string | null
  pobDir: () => string | null | undefined
  pobStatus: () => string | null
  signedIn: () => boolean
  updater: () => { state: string }
}

async function reachable (url: string): Promise<boolean> {
  const ctl = new AbortController()
  const timer = setTimeout(() => { ctl.abort() }, 8000)
  try {
    const res = await net.fetch(url, { method: 'HEAD', signal: ctl.signal, cache: 'no-store' })
    return res.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function healthCheck (d: HealthDeps): Promise<HealthItem[]> {
  const out: HealthItem[] = []
  const log = d.clientLog()
  out.push(log
    ? { name: 'Game log (Client.txt)', ok: true, detail: 'found' }
    : { name: 'Game log (Client.txt)', ok: false, detail: 'Not found. Start the game once with Orbhoarder running, or set the path in Settings → General. Levelling, sessions and trades need it.' })
  const cfg = d.gameConfig()
  out.push(cfg
    ? { name: 'Game settings (production_Config.ini)', ok: true, detail: 'found' }
    : { name: 'Game settings (production_Config.ini)', ok: false, detail: 'Not found. Set it in Settings → General (Documents\\My Games\\Path of Exile). Needed for some hotkeys.' })
  const pob = d.pobDir()
  out.push(pob
    ? { name: 'Path of Building', ok: true, detail: `installed (pinned version ${POB_PIN.slice(0, 7)})` }
    : { name: 'Path of Building', ok: false, detail: d.pobStatus() ?? 'Not installed yet. Open the setup guide (wand button on the top bar).' })
  out.push(d.signedIn()
    ? { name: 'GitHub sign-in (build sync, reports)', ok: true, detail: 'signed in' }
    : { name: 'GitHub sign-in (build sync, reports)', ok: false, warn: true, detail: 'Not signed in: friends\' builds, the trade board and Bug / Idea sending need it (Build panel → Sync).' })
  const [ninja, github] = await Promise.all([reachable('https://poe.ninja/'), reachable('https://github.com/')])
  out.push(ninja
    ? { name: 'poe.ninja (prices)', ok: true, detail: 'reachable' }
    : { name: 'poe.ninja (prices)', ok: false, detail: 'Not reachable: prices, Market and Profit stay empty. Check your internet or firewall.' })
  out.push(github
    ? { name: 'GitHub (updates, Path of Building)', ok: true, detail: 'reachable' }
    : { name: 'GitHub (updates, Path of Building)', ok: false, detail: 'Not reachable: updates and Path of Building downloads fail. Check your internet or firewall.' })
  const l = listenInfo()
  out.push(!l || l.port === STABLE_PORT
    ? { name: 'App port', ok: true, detail: String(l?.port ?? STABLE_PORT) }
    : { name: 'App port', ok: false, warn: true, detail: `Port ${STABLE_PORT} was taken by another program; using ${l.port}. Panel data saved this run won't carry over. Restart Orbhoarder (or the other program).` })
  const u = d.updater()
  out.push(u.state === 'error'
    ? { name: 'Updates', ok: false, warn: true, detail: 'The last update check failed. Settings → About → Check again.' }
    : { name: 'Updates', ok: true, detail: `${app.getVersion()} (${u.state.replace(/-/g, ' ')})` })
  return out
}

export function remoteInfo () {
  const l = listenInfo()
  const wide = l?.host === '0.0.0.0' || l?.host === '::'
  const on = remoteAccessOn()
  const key = wide ? remoteKey() : ''
  return {
    // the setting (after restart) and what the server does now
    enabled: on,
    listening: wide,
    urls: wide && l ? lanAddresses().map(ip => `http://${ip}:${l.port}/?desktop&key=${key}`) : []
  }
}

export function setRemote (enabled: boolean) {
  setRemoteAccess(enabled)
  return remoteInfo()
}

export function newKey () {
  newRemoteKey()
  return remoteInfo()
}

export async function saveBackup (text: string): Promise<{ ok: boolean, path?: string, error?: string }> {
  const name = `Orbhoarder-backup-${new Date().toISOString().slice(0, 10)}.json`
  const res = await dialog.showSaveDialog({
    title: 'Save Orbhoarder settings backup',
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'Orbhoarder backup', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  try {
    await fs.promises.writeFile(res.filePath, text, 'utf8')
    return { ok: true, path: res.filePath }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function openBackup (): Promise<{ ok: boolean, text?: string, error?: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Restore Orbhoarder settings',
    defaultPath: app.getPath('documents'),
    filters: [{ name: 'Orbhoarder backup', extensions: ['json'] }],
    properties: ['openFile']
  })
  const file = res.filePaths[0]
  if (res.canceled || !file) return { ok: false }
  try {
    const st = await fs.promises.stat(file)
    if (st.size > MAX_BACKUP_BYTES) return { ok: false, error: 'That file is too large for a backup.' }
    return { ok: true, text: await fs.promises.readFile(file, 'utf8') }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
