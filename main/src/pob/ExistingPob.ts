// Deathloom fork: builds from a Path of Building install the player already had
// (first-run setup guide offers to copy them into Loot Goblin's builds folder).
//
// PoB Community keeps its settings in Documents\Path of Building\Settings.xml.
// Builds are in Documents\Path of Building\Builds unless the settings say
// otherwise (<Misc buildPath="...">).
import { promises as fs, constants } from 'fs'
import * as path from 'path'

const MAX_FILES = 5000
const MAX_DEPTH = 6

export interface ExistingBuilds {
  buildsDir: string
  count: number
}

function unescapeXml (s: string) {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function samePath (a: string, b: string) {
  const norm = (p: string) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()
  return norm(a) === norm(b)
}

function inside (child: string, parent: string) {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

// Builds folder of an existing PoB install, or null if there's none (or it's ours)
export async function findExistingBuilds (documents: string, ourBuildsDir: string): Promise<ExistingBuilds | null> {
  const pobUser = path.join(documents, 'Path of Building')
  let buildsDir = path.join(pobUser, 'Builds')
  try {
    const xml = await fs.readFile(path.join(pobUser, 'Settings.xml'), 'utf8')
    const m = /<Misc\b[^>]*\sbuildPath="([^"]*)"/.exec(xml)
    if (m?.[1]) buildsDir = unescapeXml(m[1])
  } catch {}
  if (!path.isAbsolute(buildsDir)) return null
  // already the folder Loot Goblin uses (or inside it / around it): nothing to copy
  if (ourBuildsDir && (inside(buildsDir, ourBuildsDir) || inside(ourBuildsDir, buildsDir))) return null
  const files = await listBuilds(buildsDir)
  return files.length ? { buildsDir, count: files.length } : null
}

// .xml files under dir, as paths relative to it
async function listBuilds (dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk (rel: string, depth: number) {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
    let entries
    try {
      entries = await fs.readdir(path.join(dir, rel), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      if (e.name.startsWith('.')) continue
      const r = rel ? path.join(rel, e.name) : e.name
      // no symlinks/junctions: only real files and folders
      if (e.isDirectory()) await walk(r, depth + 1)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.xml')) out.push(r)
    }
  }
  await walk('', 0)
  return out
}

// Copies every build (keeping sub folders) into target. Never overwrites:
// a build that already exists there is skipped.
export async function copyBuilds (from: string, target: string): Promise<{ copied: number, skipped: number }> {
  if (samePath(from, target) || inside(target, from) || inside(from, target)) {
    throw new Error('The builds are already in this folder')
  }
  const files = await listBuilds(from)
  let copied = 0
  let skipped = 0
  for (const rel of files) {
    const dest = path.join(target, rel)
    if (!inside(dest, target)) { skipped++; continue }
    await fs.mkdir(path.dirname(dest), { recursive: true })
    try {
      await fs.copyFile(path.join(from, rel), dest, constants.COPYFILE_EXCL)
      copied++
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') skipped++
      else throw err
    }
  }
  return { copied, skipped }
}
