// Deathloom fork: take personal data and secrets out of problem reports and log
// lines before they leave the PC (ErrorReporter). No Electron imports, so the
// tests can run it in plain Node.

function escapeRe (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The home folder (it holds the Windows user name) in any spelling Windows and
// our logs produce: any case, / or \ (also doubled, as in JSON), so
// "c:\users\name", "C:/Users/Name" and "C:\\Users\\Name" all become %USERPROFILE%.
export function homePattern (home: string): RegExp | null {
  const parts = home.split(/[\\/]+/).filter(Boolean)
  if (parts.length < 2) return null
  const lead = /^[\\/]/.test(home) ? '[\\\\/]+' : ''
  return new RegExp(lead + parts.map(escapeRe).join('[\\\\/]+') + '(?![A-Za-z0-9_.-])', 'gi')
}

export function scrubText (text: string, home: string): string {
  const re = home ? homePattern(home) : null
  const out = re ? text.replace(re, '%USERPROFILE%') : text
  return out
    .replace(/\b(?:gh[opusr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '<token>')
    .replace(/\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{16,}/gi, '$1 <token>')
    .replace(/(POESESSID\s*[=:]\s*"?)[A-Za-z0-9]+/gi, '$1<session>')
    .replace(/((?:access_token|refresh_token|client_secret|device_code|password|secret)["']?\s*[=:]\s*["']?)[^\s"'&,}]+/gi, '$1<secret>')
}
