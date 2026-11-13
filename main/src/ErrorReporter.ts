// Deathloom fork: automatic problem reports.
//
// Crashes and code errors (main process, overlay pages, Path of Building's Lua)
// become GitHub issues in the group's private builds repo, sent through PoB's
// SyncServer with the person's own GitHub sign-in (no secret in the app).
// One issue per problem (key = hash of where it happened); repeats add a
// comment. At most one send per problem and a few per app run. Nothing is sent
// when not signed in or when turned off (Settings → Path of Building).

import * as crypto from 'crypto'
import * as os from 'os'
import { app } from 'electron'
import type { ServerEvents } from './server'
import type { Logger } from './RemoteLogger'

export type ReportSource = 'main' | 'overlay' | 'pob'

export interface ReportSender {
  // false when it couldn't be sent (not signed in, offline, ...)
  report: (r: { key: string, title: string, body: string, seen: string }) => Promise<{ sent: boolean, reason?: string }>
}

const MAX_PER_RUN = 5
const LOG_LINES = 40

// Lines that look like our own code failing (not "build not found" style messages)
export function isCodeError (message: string): boolean {
  return /\.lua:\d+:/.test(message) || /\b(TypeError|ReferenceError|RangeError|SyntaxError)\b/.test(message)
}

// Same problem -> same key: numbers, paths and quoted values left out
export function reportKey (source: ReportSource, message: string, stack?: string): string {
  const firstFrame = (stack ?? '').split('\n').map(l => l.trim()).find(l => l.startsWith('at ')) ?? ''
  const norm = (s: string) => s
    .replace(/[A-Za-z]:[\\/][^\s:'"]*/g, '<path>')
    .replace(/\/[^\s:'"]+\//g, '<path>/')
    .replace(/"[^"]*"|'[^']*'/g, '<v>')
    // keep Lua line numbers (they tell code sites apart), drop other numbers
    .replace(/(\.lua:\d+)|\d+/g, (m, lua: string | undefined) => lua ?? 'n')
  const text = `${source}|${norm(message.split('\n')[0])}|${norm(firstFrame.replace(/:\d+:\d+\)?$/, ''))}`
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)
}

// No home folder (Windows user name) in reports
export function scrub (text: string): string {
  const home = os.homedir()
  let out = text
  if (home) {
    out = out.split(home).join('%USERPROFILE%')
    out = out.split(home.replace(/\\/g, '/')).join('%USERPROFILE%')
  }
  return out
}

export class ErrorReporter {
  private sentKeys = new Set<string>()
  private sentCount = 0
  enabled: () => boolean = () => true

  constructor (
    private logger: Logger,
    private sender: ReportSender,
    server: ServerEvents
  ) {
    process.on('uncaughtException', (err) => {
      this.logger.write(`error [main] ${err.stack ?? err.message}`)
      this.capture('main', err.message, err.stack)
    })
    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason))
      this.logger.write(`error [main] unhandled rejection: ${err.stack ?? err.message}`)
      this.capture('main', err.message, err.stack)
    })
    server.onEventAnyClient('CLIENT->MAIN::report-error', (e) => {
      this.logger.write(`error [overlay] ${e.message}${e.stack ? '\n' + e.stack : ''}`)
      this.capture('overlay', e.message, e.stack, e.where)
    })
  }

  capture (source: ReportSource, message: string, stack?: string, where?: string) {
    try {
      if (!this.enabled() || !message) return
      const key = reportKey(source, message, stack)
      if (this.sentKeys.has(key) || this.sentCount >= MAX_PER_RUN) return
      this.sentKeys.add(key)
      this.sentCount += 1
      const version = app.getVersion()
      const firstLine = scrub(message.split('\n')[0]).slice(0, 110)
      const log = scrub(this.logger.history.trimEnd().split('\n').slice(-LOG_LINES).join('\n'))
      const body = [
        `**Loot Goblin** ${version} · ${os.type()} ${os.release()} · ${source}${where ? ` (${where})` : ''}`,
        '',
        '```',
        scrub(message),
        scrub(stack ?? '').trim(),
        '```',
        '',
        '<details><summary>Last log lines</summary>',
        '',
        '```',
        log,
        '```',
        '',
        '</details>',
        '',
        '_Sent automatically by Loot Goblin. Turn off in Settings → Path of Building._'
      ].join('\n')
      void this.sender.report({
        key,
        title: `[auto] ${source}: ${firstLine}`,
        body,
        seen: `Seen again: Loot Goblin ${version} · ${os.type()} ${os.release()}${where ? ` · ${where}` : ''}`
      }).then((res) => {
        this.logger.write(res.sent ? `info [report] sent problem report ${key}` : `info [report] not sent (${res.reason ?? 'unknown'})`)
      }).catch((err: Error) => {
        this.logger.write(`info [report] not sent (${err.message})`)
      })
    } catch {
      // never let reporting itself fail the app
    }
  }
}
