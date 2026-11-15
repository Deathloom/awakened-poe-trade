// Deathloom fork: notes per build (guide text, map mods the build can't run,
// loot filter). Kept next to the builds so build sync carries them:
// <player folder>/Build notes/<build path without .xml>.txt
// PoB's sync already handles .txt files, so Push uploads your own and Pull
// brings friends'. Only your own folder is ever written. Friends' notes are
// someone else's text: size-capped, parsed as plain text, shown as plain text.

import path from 'path'
import { promises as fs } from 'fs'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { BuildNotesData } from '../../../ipc/types'
import { safeSegment } from './BuildFiles'

const DIR = 'Build notes'
const MAX_BYTES = 32 * 1024
const MAX_TEXT = 20000
const MAX_MODS = 40
const MAX_MOD = 60
const MAX_FILTER = 300

export interface ActiveBuild { playerDir: string, rel: string, own: boolean, player: string }

// eslint-disable-next-line no-control-regex
const oneLine = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : ''

export function cleanNotes (d: Partial<BuildNotesData> | undefined): BuildNotesData {
  const text = typeof d?.text === 'string'
    // eslint-disable-next-line no-control-regex
    ? d.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, MAX_TEXT)
    : ''
  const mods: string[] = []
  for (const m of Array.isArray(d?.mapMods) ? d!.mapMods : []) {
    const v = oneLine(m, MAX_MOD).toLowerCase()
    if (v && !mods.includes(v)) mods.push(v)
    if (mods.length >= MAX_MODS) break
  }
  return { text, mapMods: mods, filter: oneLine(d?.filter, MAX_FILTER) }
}

// Readable on GitHub; "## " starts a section. A line in the notes that starts
// with "## " is written as "\\## " so it can't start a section.
export function notesToFile (d: BuildNotesData): string {
  const text = d.text.split('\n').map(l => l.startsWith('## ') ? `\\${l}` : l).join('\n')
  return [
    '# Orbhoarder build notes (edit them in Orbhoarder: Build panel → Notes)',
    '## Notes',
    text,
    '## Map mods to avoid',
    ...d.mapMods,
    '## Loot filter',
    d.filter,
    ''
  ].join('\n')
}

export function notesFromFile (raw: string): BuildNotesData {
  const sections: Record<string, string[]> = {}
  let cur = ''
  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('## ')) { cur = line.slice(3).trim().toLowerCase(); sections[cur] = []; continue }
    if (!cur) continue
    sections[cur].push(line.startsWith('\\## ') ? line.slice(1) : line)
  }
  const text = (sections.notes ?? []).join('\n').replace(/\n+$/, '')
  const mapMods = (sections['map mods to avoid'] ?? []).map(l => l.trim()).filter(Boolean)
  const filter = (sections['loot filter'] ?? []).map(l => l.trim()).find(Boolean) ?? ''
  return cleanNotes({ text, mapMods, filter })
}

// "3.29\\Witch\\Build.xml" -> "<playerDir>/Build notes/3.29/Witch/Build.txt"
export function notesFile (playerDir: string, rel: string): string {
  const parts = rel.split(/[\\/]+/).filter(Boolean)
  const last = parts.pop() ?? ''
  if (!/\.xml$/i.test(last)) throw new Error('Not a build file')
  const name = last.replace(/\.xml$/i, '')
  if (![...parts, name].every(safeSegment) || parts.length > 6) throw new Error('Build path not usable for notes')
  return path.join(playerDir, DIR, ...parts, `${name}.txt`)
}

export class BuildNotes {
  private queue = Promise.resolve()

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private active: () => Promise<ActiveBuild>,
    private onChanged: () => void
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::build-notes', (req) => {
      const send = this.server.replyTo()
      this.queue = this.queue.then(async () => {
        let payload
        try {
          payload = await this.handle(req.op, req.data)
        } catch (e) {
          payload = { ok: false, error: (e as Error).message }
        }
        send({ name: 'MAIN->CLIENT::build-notes', payload: { requestId: req.requestId, ...payload } })
        if (payload.ok && req.op === 'save') {
          // other windows (overlay map check, HUD) reload
          this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::build-notes', payload: { requestId: -1, ...payload } })
        }
      })
    })
  }

  private async handle (op: 'get' | 'save', data?: BuildNotesData) {
    const a = await this.active()
    const file = notesFile(a.playerDir, a.rel)
    const base = { ok: true, build: a.rel, player: a.player, own: a.own }
    if (op === 'save') {
      if (!a.own) throw new Error("Friends' notes are read-only (switch Player back to yourself)")
      const clean = cleanNotes(data)
      await fs.mkdir(path.dirname(file), { recursive: true })
      const tmp = `${file}.lg-tmp`
      await fs.writeFile(tmp, notesToFile(clean), 'utf8')
      await fs.rename(tmp, file)
      this.logger.write(`info [Build notes] saved ${a.rel}`)
      this.onChanged()
      return { ...base, data: clean, saved: true }
    }
    let data2 = cleanNotes(undefined)
    try {
      const st = await fs.stat(file)
      if (st.size <= MAX_BYTES) data2 = notesFromFile(await fs.readFile(file, 'utf8'))
    } catch {}
    return { ...base, data: data2 }
  }
}
