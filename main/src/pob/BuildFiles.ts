// Deathloom fork: manage builds from the Loot Goblin window (rename, move to a
// folder, duplicate, delete). Only inside your own player folder. Delete moves
// the file to "Deleted builds" next to the builds folder (same place Path of
// Building's sync uses), so it can be recovered; the next Push deletes it on
// GitHub too.

import path from 'path'
import { promises as fs } from 'fs'

export interface BuildFileOp {
  op: 'rename' | 'move' | 'duplicate' | 'delete'
  path: string
  // rename: new file name (without .xml)
  name?: string
  // move: folder inside your player folder, e.g. "3.30/Witch" ('' = top)
  folder?: string
}

const BAD_CHARS = /[<>:"|?*\u0000-\u001f]/
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)(\..*)?$/i

// one path segment: no separators, no reserved names, no trailing dot/space
export function safeSegment (name: string): boolean {
  return name.length > 0 && name.length <= 120 &&
    !BAD_CHARS.test(name) && !/[\\/]/.test(name) &&
    name !== '.' && name !== '..' && !name.startsWith('.') &&
    !/[. ]$/.test(name) && !RESERVED.test(name)
}

// "3.30/Witch" or "" (top of your folder)
export function safeFolder (folder: string): string | null {
  const parts = folder.split(/[\\/]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length > 6) return null
  return parts.every(safeSegment) ? parts.join(path.sep) : null
}

function inside (root: string, rel: string): string {
  const full = path.resolve(root, rel)
  const r = path.resolve(root) + path.sep
  if (!full.startsWith(r)) throw new Error('Not in your builds folder')
  return full
}

async function exists (p: string) {
  try { await fs.access(p); return true } catch { return false }
}

async function freeName (dir: string, base: string, ext: string): Promise<string> {
  let n = 1
  let name = `${base}${ext}`
  while (await exists(path.join(dir, name))) {
    n++
    name = `${base} (${n})${ext}`
  }
  return name
}

// Returns the build's new path (relative to root), or null after delete
export async function applyBuildOp (root: string, deletedRoot: string, req: BuildFileOp): Promise<string | null> {
  if (typeof req.path !== 'string' || !req.path.toLowerCase().endsWith('.xml')) throw new Error('Not a build file')
  const from = inside(root, req.path)
  if (!(await exists(from))) throw new Error('Build not found')
  const dir = path.dirname(from)
  const ext = path.extname(from)

  switch (req.op) {
    case 'rename': {
      const name = String(req.name ?? '').trim().replace(/\.xml$/i, '')
      if (!safeSegment(name)) throw new Error('That name has characters Windows doesn\'t allow')
      const to = path.join(dir, `${name}${ext}`)
      if (to.toLowerCase() === from.toLowerCase() && to !== from) {
        // only the letter case changed (Windows): go through a temporary name
        const tmp = path.join(dir, `.lg-rename-${Date.now()}${ext}`)
        await fs.rename(from, tmp)
        await fs.rename(tmp, to)
      } else {
        if (await exists(to)) throw new Error('A build with that name already exists here')
        await fs.rename(from, to)
      }
      return path.relative(root, to)
    }
    case 'move': {
      const folder = safeFolder(String(req.folder ?? ''))
      if (folder == null) throw new Error('That folder name has characters Windows doesn\'t allow')
      const targetDir = inside(root, folder || '.')
      await fs.mkdir(targetDir, { recursive: true })
      const name = await freeName(targetDir, path.basename(from, ext), ext)
      const to = path.join(targetDir, name)
      if (to === from) return req.path
      await fs.rename(from, to)
      await removeEmptyDirs(root, dir)
      return path.relative(root, to)
    }
    case 'duplicate': {
      const name = await freeName(dir, `${path.basename(from, ext)} - copy`, ext)
      const to = path.join(dir, name)
      await fs.copyFile(from, to)
      return path.relative(root, to)
    }
    case 'delete': {
      const rel = path.relative(root, from)
      const target = path.join(deletedRoot, rel)
      await fs.mkdir(path.dirname(target), { recursive: true })
      const tdir = path.dirname(target)
      const name = await freeName(tdir, path.basename(target, ext), ext)
      try {
        await fs.rename(from, path.join(tdir, name))
      } catch {
        await fs.copyFile(from, path.join(tdir, name))
        await fs.unlink(from)
      }
      await removeEmptyDirs(root, dir)
      return null
    }
    default:
      throw new Error('Unknown build operation')
  }
}

// tidy up folders left empty by a move/delete (never the player folder itself)
async function removeEmptyDirs (root: string, dir: string) {
  const top = path.resolve(root)
  let d = path.resolve(dir)
  while (d.startsWith(top + path.sep)) {
    try {
      const left = await fs.readdir(d)
      if (left.length) return
      await fs.rmdir(d)
    } catch { return }
    d = path.dirname(d)
  }
}
