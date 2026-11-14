// Deathloom fork: What's new popup. The text is CHANGELOG.md, bundled at build
// time, so it always matches the installed version.
import CHANGELOG from '../../../../CHANGELOG.md?raw'

export interface ChangelogVersion { version: string, date: string, body: string }

// "## [1.0.31] - 2026-11-14" sections, newest first (Unreleased skipped)
export function parseChangelog (text: string = CHANGELOG): ChangelogVersion[] {
  const out: ChangelogVersion[] = []
  const parts = text.split(/^## /m).slice(1)
  for (const part of parts) {
    const m = part.match(/^\[(\d+\.\d+\.\d+)\](?:\s*-\s*(\S+))?[^\n]*\n([\s\S]*)$/)
    if (!m) continue
    out.push({ version: m[1], date: m[2] ?? '', body: m[3].trim() })
  }
  return out
}

export function compareVersions (a: string, b: string): number {
  const pa = a.split('.').map(Number); const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

// versions after `seen`, up to and including `current`
export function changesSince (seen: string, current: string): ChangelogVersion[] {
  return parseChangelog().filter(v => compareVersions(v.version, seen) > 0 && compareVersions(v.version, current) <= 0)
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Small markdown subset used in CHANGELOG.md: ### headings, - bullets, **bold**,
// `code`, [text](https link). Everything is escaped first.
export function renderMarkdown (md: string): string {
  const inline = (s: string) => escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`([^`]+)`/g, '<code class="text-gray-300">$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" class="underline">$1</a>')
  const html: string[] = []
  let inList = false
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*] (.*)$/)
    if (bullet) {
      if (!inList) { html.push('<ul class="list-disc pl-5 mb-2">'); inList = true }
      html.push(`<li class="mb-1">${inline(bullet[1])}</li>`)
      continue
    }
    if (inList) { html.push('</ul>'); inList = false }
    const head = line.match(/^###\s+(.*)$/)
    if (head) html.push(`<div class="text-gray-400 text-sm mt-2 mb-1">${inline(head[1].replace(/\s*\(#\d+\)\s*(:?)\s*/, '$1 ').trim())}</div>`)
    else if (line.trim()) html.push(`<p class="mb-2">${inline(line)}</p>`)
  }
  if (inList) html.push('</ul>')
  return html.join('')
}
