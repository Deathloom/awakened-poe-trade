// Deathloom fork: friends' trade board (Give / Sell / Wanted).
//
// Listings are GitHub issues in the group's builds repo, read and written by
// Path of Building's src\SyncServer.lua with the player's own GitHub sign-in
// (the same one build sync uses). GitHub says who posted, so nobody can post
// as someone else, and only the poster can close a listing. Nothing here talks
// to the game: contacting a friend is a whisper button (one chat message per
// click) in the renderer.

import type { BoardState, IpcEventPayload } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { PobSync } from './PobSync'

type BoardOp = IpcEventPayload<'CLIENT->MAIN::board'>

// don't list more often than this (each list is a few GitHub requests)
const MIN_LIST_GAP = 20_000

export class TradeBoard {
  private state: BoardState = { busy: null, signedIn: null, listings: [], updated: null, done: 0 }
  private lastList = 0

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private sync: PobSync
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::board', (req) => {
      void this.handle(req)
    })
  }

  private publish (patch: Partial<BoardState> = {}) {
    this.state = { ...this.state, ...patch }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::board-state',
      payload: this.state
    })
  }

  private async handle (req: BoardOp) {
    if (req.op === 'state') {
      this.publish()
      return
    }
    if (req.op === 'list') {
      if (this.state.busy || Date.now() - this.lastList < MIN_LIST_GAP) {
        this.publish()
        return
      }
      await this.list()
      return
    }
    const busy = req.op === 'post' ? 'Posting…' : req.op === 'comment' ? 'Sending…' : 'Closing…'
    this.publish({ busy, error: undefined })
    try {
      const reply = await this.sync.board({
        op: req.op,
        kind: req.kind,
        title: req.title,
        body: req.body,
        number: req.number,
        reason: req.reason
      })
      if (reply.signedIn === false) {
        this.publish({ busy: null, signedIn: false, error: String(reply.reason ?? 'Not signed in to GitHub') })
        return
      }
      if (reply.success !== true) {
        this.publish({ busy: null, error: String(reply.reason ?? 'GitHub said no') })
        return
      }
      this.logger.write(`info [board] ${req.op}${req.number ? ` #${req.number}` : ''} done`)
      this.publish({ busy: null, done: this.state.done + 1 })
      this.lastList = 0
      await this.list()
    } catch (err) {
      this.publish({ busy: null, error: (err as Error).message })
    }
  }

  private async list () {
    this.lastList = Date.now()
    this.publish({ busy: 'Loading…', error: undefined })
    try {
      const reply = await this.sync.board({ op: 'list' })
      if (reply.signedIn === false) {
        this.publish({ busy: null, signedIn: false, listings: [], error: undefined })
        return
      }
      if (reply.success !== true) {
        this.publish({ busy: null, signedIn: true, login: reply.login, error: String(reply.reason ?? 'GitHub said no') })
        return
      }
      const listings = Array.isArray(reply.listings) ? reply.listings : []
      this.publish({
        busy: null,
        signedIn: true,
        login: typeof reply.login === 'string' ? reply.login : undefined,
        listings: listings.map((l: any) => ({
          number: Number(l.number),
          title: String(l.title ?? ''),
          body: String(l.body ?? ''),
          author: typeof l.author === 'string' ? l.author : undefined,
          created: typeof l.created === 'string' ? l.created : undefined,
          updated: typeof l.updated === 'string' ? l.updated : undefined,
          commentCount: Number(l.commentCount) || 0,
          comments: (Array.isArray(l.comments) ? l.comments : []).map((c: any) => ({
            author: typeof c.author === 'string' ? c.author : undefined,
            body: String(c.body ?? ''),
            created: typeof c.created === 'string' ? c.created : undefined
          }))
        })).filter((l: { number: number }) => Number.isInteger(l.number) && l.number > 0),
        updated: Date.now()
      })
    } catch (err) {
      this.publish({ busy: null, error: (err as Error).message })
    }
  }
}
