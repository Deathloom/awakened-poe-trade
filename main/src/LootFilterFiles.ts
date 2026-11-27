// Deathloom fork (Q10): loot filter add-on, the file side. No Electron imports, so the
// checks are unit-tested on a temp folder (tests/logic.test.mjs).
//
// Rules: only the game's filter folder (real path, symlinks resolved), only .filter
// files directly in it, his filter at most MAX_FILTER_BYTES, and the only file ever
// written is "<his filter> + Orbhoarder.filter". An existing file of that name is
// only replaced when it is one of ours (starts with ADDON_MARKER), never followed
// when it is a link. His own filter is only read.

import { promises as fs, constants as fsc } from 'fs'
import * as path from 'path'
import {
  addonBlocks, addonFileName, cleanWants, isAddonFileName, isAddonText, isFilterFileName,
  wantsCount, MAX_FILTER_BYTES, type LootFilterWants
} from '../../ipc/loot-filter'
import type { Game } from '../../ipc/game'

function sameDir (a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

// his filters in the folder (not our add-ons, not links, not too big), sorted
export async function listFilters (dir: string): Promise<string[]> {
  const real = await fs.realpath(dir)
  const out: string[] = []
  for (const ent of await fs.readdir(real, { withFileTypes: true })) {
    if (!ent.isFile() || !isFilterFileName(ent.name) || isAddonFileName(ent.name)) continue
    try {
      const st = await fs.stat(path.join(real, ent.name))
      if (st.size <= MAX_FILTER_BYTES) out.push(ent.name)
    } catch {}
  }
  return out.sort((a, b) => a.localeCompare(b))
}

// a file directly in the real folder; null when the name or the real path leaves it
async function fileInside (realDir: string, name: string): Promise<string | null> {
  if (!isFilterFileName(name) || path.basename(name) !== name) return null
  const full = path.join(realDir, name)
  if (!sameDir(path.dirname(full), realDir)) return null
  return full
}

export interface MakeResult { ok: boolean, error?: string, written?: string, count?: number, refused?: string[], unchanged?: boolean }

// opts.allowEmpty (Q11 automatic update): with nothing left to buy, the add-on is
// still written (just his filter) so old Show blocks don't stay
export async function makeAddon (dir: string, source: unknown, wantsIn: unknown, game: Game, when?: string, opts: { allowEmpty?: boolean } = {}): Promise<MakeResult> {
  if (typeof source !== 'string' || !isFilterFileName(source) || isAddonFileName(source)) {
    return { ok: false, error: 'Pick one of your own .filter files.' }
  }
  const outName = addonFileName(source)
  if (!outName) return { ok: false, error: 'That filter name is too long or has odd characters. Rename it in the folder and try again.' }
  const { wants, refused } = cleanWants(wantsIn)
  if (!wantsCount(wants) && !opts.allowEmpty) return { ok: false, error: 'Nothing to add: the Shopping list has nothing left to buy.', refused }

  const realDir = await fs.realpath(dir)
  const src = await fileInside(realDir, source)
  const out = await fileInside(realDir, outName)
  if (!src || !out) return { ok: false, error: 'That file is not in the filter folder.' }

  // his filter: a real file in this folder (a link to elsewhere is refused), not too big
  let srcReal: string
  try { srcReal = await fs.realpath(src) } catch { return { ok: false, error: `${source} is gone. Refresh the list.` } }
  if (!sameDir(path.dirname(srcReal), realDir)) return { ok: false, error: `${source} points outside the filter folder.` }
  const st = await fs.stat(srcReal)
  if (!st.isFile()) return { ok: false, error: `${source} is not a file.` }
  if (st.size > MAX_FILTER_BYTES) return { ok: false, error: `${source} is bigger than ${MAX_FILTER_BYTES / 1024 / 1024} MB.` }
  let body = await fs.readFile(srcReal)
  if (body.length > MAX_FILTER_BYTES) return { ok: false, error: `${source} is too big.` }
  // keep his text byte for byte (only a leading UTF-8 BOM is dropped: ours comes first)
  if (body[0] === 0xEF && body[1] === 0xBB && body[2] === 0xBF) body = body.subarray(3)

  const text = Buffer.concat([Buffer.from(addonBlocks(wants as LootFilterWants, { source, game, when }), 'utf8'), body])
  const count = wantsCount(wants) - (game === 'poe2' ? wants.gems.length : 0)

  // the file we write: never a link, and only replaced when it is ours
  try {
    const ost = await fs.lstat(out)
    if (ost.isSymbolicLink() || !ost.isFile()) return { ok: false, error: `${outName} exists and is not a normal file. Remove it first.` }
    const fh = await fs.open(out, 'r')
    try {
      const head = Buffer.alloc(64)
      const { bytesRead } = await fh.read(head, 0, 64, 0)
      if (!isAddonText(head.subarray(0, bytesRead).toString('utf8'))) {
        return { ok: false, error: `${outName} already exists and was not made by Orbhoarder. Rename or remove it first.` }
      }
      // Q11: same content already there: leave the file (and its date) alone
      if (ost.size === text.length && text.equals(await fh.readFile())) {
        return { ok: true, written: outName, count, refused, unchanged: true }
      }
    } finally { await fh.close() }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  // O_NOFOLLOW where the OS has it (not Windows): a link swapped in after the check isn't followed
  const flags = fsc.O_WRONLY | fsc.O_CREAT | fsc.O_TRUNC | (fsc.O_NOFOLLOW ?? 0)
  const fh = await fs.open(out, flags, 0o644)
  try { await fh.writeFile(text) } finally { await fh.close() }
  return { ok: true, written: outName, count, refused }
}
