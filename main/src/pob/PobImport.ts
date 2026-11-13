// Deathloom fork: import a Path of Building code or build link into the
// player folder, without opening PoB.
//
// A PoB code is the build XML, zlib-compressed and base64 encoded (URL-safe
// alphabet). Links are fetched from the same sites PoB's own import knows
// (src/Modules/BuildSiteTools.lua): they return the code as plain text.

import * as zlib from 'zlib'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { PobImportPreview } from '../../../ipc/types'

export type FetchText = (url: string) => Promise<string>

// [label, link pattern, raw code URL] (same list as PoB's BuildSiteTools.lua)
const SITES: Array<[string, RegExp, (id: string) => string]> = [
  ['Maxroll', /^https?:\/\/maxroll\.gg\/poe\/pob\/([^\s?#]+)/i, id => `https://maxroll.gg/poe/api/pob/${id}`],
  ['pob.codes', /^https?:\/\/pob\.codes\/b\/([^\s?#]+)/i, id => `https://api.pob.codes/${id}/raw`],
  ['pobb.in', /^https?:\/\/pobb\.in\/([^\s?#/]+)/i, id => `https://pobb.in/pob/${id}`],
  ['poe.ninja', /^https?:\/\/poe\.ninja\/(?:poe1\/)?pob\/(\w+)/i, id => `https://poe.ninja/poe1/pob/raw/${id}`],
  ['Pastebin', /^https?:\/\/pastebin\.com\/(?:raw\/)?(\w+)/i, id => `https://pastebin.com/raw/${id}`],
  ['Rentry', /^https?:\/\/rentry\.co\/(\w+)/i, id => `https://rentry.co/paste/${id}/raw`],
  ['poedb', /^https?:\/\/poedb\.tw\/pob\/([^\s?#]+)/i, id => `https://poedb.tw/pob/${id}/raw`]
]

export function linkSource (input: string): { site: string, url: string } | null {
  const text = input.trim()
  for (const [site, re, raw] of SITES) {
    const m = re.exec(text)
    if (m) return { site, url: raw(m[1]) }
  }
  return null
}

// PoB code -> build XML (throws with a readable message)
export function decodeCode (code: string): string {
  const clean = code.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!clean || !/^[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new Error('That is not a Path of Building code or a build link.')
  }
  const data = Buffer.from(clean, 'base64')
  let xml: string
  try {
    xml = zlib.inflateSync(data).toString('utf8')
  } catch {
    try {
      xml = zlib.inflateRawSync(data).toString('utf8')
    } catch {
      throw new Error('That is not a Path of Building code (it could not be unpacked). Copy the whole code.')
    }
  }
  if (/<PathOfBuilding2[\s>]/.test(xml)) {
    throw new Error('That is a Path of Building 2 (PoE2) build. Loot Goblin is PoE1 only for now.')
  }
  if (!/<PathOfBuilding[\s>]/.test(xml)) {
    throw new Error('The code unpacked, but it is not a Path of Building build.')
  }
  return xml
}

const unescapeXml = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function attr (tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? unescapeXml(m[1]) : undefined
}

// Class, ascendancy, level and main skill from the build XML, for the suggested name
export function buildSummary (xml: string): Omit<PobImportPreview, 'folders' | 'source' | 'name'> & { name: string } {
  const buildTag = /<Build\s[^>]*>/.exec(xml)?.[0] ?? ''
  const className = attr(buildTag, 'className')
  const ascendancy = attr(buildTag, 'ascendClassName')
  const level = Number(attr(buildTag, 'level')) || undefined
  let mainSkill: string | undefined
  const mainGroup = Number(attr(buildTag, 'mainSocketGroup')) || 1
  // Skills of the active skill set (or the only one)
  const skillsBlock = /<Skills\b[^>]*>([\s\S]*?)<\/Skills>/.exec(xml)?.[1] ?? ''
  const setBlocks = [...skillsBlock.matchAll(/<SkillSet\b[^>]*>([\s\S]*?)<\/SkillSet>/g)].map(m => m[1])
  const activeSet = Number(attr(/<Skills\b[^>]*>/.exec(xml)?.[0] ?? '', 'activeSkillSet')) || 1
  const skillsXml = setBlocks.length ? (setBlocks[activeSet - 1] ?? setBlocks[0]) : skillsBlock
  const skill = [...skillsXml.matchAll(/<Skill\b[^>]*>([\s\S]*?)<\/Skill>/g)][mainGroup - 1]?.[1]
  if (skill) {
    const gem = [...skill.matchAll(/<Gem\b[^>]*>/g)]
      .map(m => m[0])
      .find(tag => attr(tag, 'enabled') !== 'false' && !/Support/i.test(attr(tag, 'skillId') ?? '') && attr(tag, 'nameSpec'))
    mainSkill = gem ? attr(gem, 'nameSpec') : undefined
  }
  const who = ascendancy && ascendancy !== 'None' ? ascendancy : className
  const name = safeName([who, mainSkill].filter(Boolean).join(' ') || 'Imported build')
  return { name, className, ascendancy: ascendancy !== 'None' ? ascendancy : undefined, level, mainSkill }
}

// File name without characters Windows refuses
export function safeName (name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 100)
}

// Sub folders of the player folder, relative ('' first)
export async function listFolders (root: string): Promise<string[]> {
  const out: string[] = ['']
  const walk = async (dir: string, depth: number) => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      out.push(path.relative(root, full))
      if (depth < 4) await walk(full, depth + 1)
    }
  }
  await walk(root, 0)
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

// Folder typed or picked in the dialog: relative, inside the player folder, safe names
export function cleanFolder (folder: string): string {
  const parts = folder.split(/[\\/]+/).map(p => safeName(p)).filter(p => p && p !== '.' && p !== '..')
  return parts.join(path.sep)
}

export class PobImport {
  // last fetched/decoded input, so Save doesn't download again
  private cache: { input: string, xml: string, source: string } | null = null

  constructor (private fetchText: FetchText) {}

  async decode (input: string): Promise<{ xml: string, source: string }> {
    const text = input.trim()
    if (this.cache?.input === text) return this.cache
    const link = linkSource(text)
    let xml: string
    let source = 'code'
    if (link) {
      source = link.site
      let code: string
      try {
        code = await this.fetchText(link.url)
      } catch (err) {
        throw new Error(`Couldn't download the build from ${link.site}: ${(err as Error).message}`)
      }
      xml = decodeCode(code)
    } else if (/^https?:\/\//i.test(text)) {
      throw new Error('Unknown build site. Supported: pobb.in, pastebin.com, poe.ninja, maxroll.gg, pob.codes, rentry.co, poedb.tw — or paste the PoB code itself.')
    } else {
      xml = decodeCode(text)
    }
    this.cache = { input: text, xml, source }
    return this.cache
  }

  async preview (input: string, playerDir: string): Promise<PobImportPreview> {
    const { xml, source } = await this.decode(input)
    return { ...buildSummary(xml), folders: await listFolders(playerDir), source }
  }

  // Writes <playerDir>/<folder>/<name>.xml; returns the path relative to playerDir
  async save (input: string, playerDir: string, name: string, folder: string, overwrite: boolean): Promise<{ rel: string } | { exists: string }> {
    const { xml } = await this.decode(input)
    const fileName = safeName(name.replace(/\.xml$/i, ''))
    if (!fileName) throw new Error('Give the build a name.')
    const rel = path.join(cleanFolder(folder), fileName + '.xml')
    const full = path.join(playerDir, rel)
    if (!overwrite) {
      try {
        await fs.access(full)
        return { exists: rel }
      } catch {}
    }
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, xml, 'utf8')
    return { rel }
  }
}
