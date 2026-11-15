// Deathloom fork: What's new popup. The text is CHANGELOG.md, bundled at build
// time, so it always matches the installed version.
import CHANGELOG from '../../../../CHANGELOG.md?raw'

export interface ChangelogVersion { version: string, date: string, body: string }

export const isTestVersion = (v: string) => /^\d+\.\d+\.\d+-beta\.\d+$/.test(v)

// "## [1.0.31] - 2026-11-14" sections, newest first. [Unreleased] is skipped,
// except in a test version (x.y.z-beta.N): that's what the test version has
// on top of the last release, so it's shown under the test version's number.
export function parseChangelog (text: string = CHANGELOG, current = ''): ChangelogVersion[] {
  const out: ChangelogVersion[] = []
  const parts = text.split(/^## /m).slice(1)
  for (const part of parts) {
    if (isTestVersion(current)) {
      const u = part.match(/^\[Unreleased\][^\n]*\n([\s\S]*)$/i)
      if (u) {
        if (u[1].trim()) out.push({ version: current, date: 'test version', body: u[1].trim() })
        continue
      }
    }
    const m = part.match(/^\[(\d+\.\d+\.\d+)\](?:\s*-\s*(\S+))?[^\n]*\n([\s\S]*)$/)
    if (!m) continue
    out.push({ version: m[1], date: m[2] ?? '', body: m[3].trim() })
  }
  return out
}

// 1.0.89-beta.2 < 1.0.89-beta.3 < 1.0.89 < 1.0.90
export function compareVersions (a: string, b: string): number {
  const split = (v: string) => {
    const [main, pre] = v.split('-')
    const n = main.split('.').map(Number)
    const beta = pre ? Number(pre.replace(/^beta\./, '')) || 0 : Infinity
    return [n[0] || 0, n[1] || 0, n[2] || 0, beta]
  }
  const pa = split(a); const pb = split(b)
  for (let i = 0; i < 4; i++) {
    if (pa[i] === pb[i]) continue
    return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

// versions after `seen`, up to and including `current`
export function changesSince (seen: string, current: string): ChangelogVersion[] {
  return parseChangelog(CHANGELOG, current).filter(v => compareVersions(v.version, seen) > 0 && compareVersions(v.version, current) <= 0)
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
