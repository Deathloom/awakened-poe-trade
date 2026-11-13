import { WebSocketServer, type WebSocket } from 'ws'
import { type AddressInfo } from 'net'
import { createServer } from 'http'
import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { IpcEvent, IpcEventPayload, HostState } from '../../ipc/types'
import { ConfigStore } from './host-files/ConfigStore'
import { addFileUploadRoutes } from './host-files/file-uploads'
import type { AppUpdater } from './AppUpdater'
import type { Logger } from './RemoteLogger'
import { isAllowedRequest, safeJoin } from './request-guard'

export const server = createServer()

// Deathloom fork: refuse requests and WebSocket upgrades from other web pages
// (see request-guard.ts). Checked before any route or the WebSocket server sees them.
const listenHost = process.argv.find(arg => arg.startsWith('--listen='))?.split('=')[1]?.split(':')[0] || undefined
let rejectedCount = 0
const serverEmit = server.emit.bind(server)
server.emit = ((event: string, ...args: any[]) => {
  if (event === 'request' || event === 'upgrade') {
    const req = args[0]
    if (!isAllowedRequest({ host: req.headers.host, origin: req.headers.origin }, { listenHost })) {
      if (rejectedCount++ < 20) {
        console.warn(`[server] refused ${event} ${String(req.url).slice(0, 80)} from origin=${String(req.headers.origin)} host=${String(req.headers.host)}`)
      }
      if (event === 'request') {
        const res = args[1]
        res.statusCode = 403
        res.end()
      } else {
        args[1].destroy()
      }
      return true
    }
  }
  return serverEmit(event, ...args)
}) as typeof server.emit
const websocketServer = new WebSocketServer({ noServer: true })
let lastActiveClient: WebSocket
// Deathloom fork: the HUD window ("show while playing") connects as a second
// client. It only listens; replies meant for the overlay never go to it.
const hudClients = new WeakSet<WebSocket>()
// the client whose message is being handled right now (see replyTo)
let dispatchingSocket: WebSocket | undefined

addFileUploadRoutes(server)

if (!process.env.VITE_DEV_SERVER_URL) {
  server.addListener('request', (req, res) => {
    if (req.url?.startsWith('/config') || req.url?.startsWith('/uploads') || req.url?.startsWith('/proxy')) return

    // Deathloom fork: ignore the query string (the HUD window loads index.html?hud)
    const urlPath = req.url!.split('?')[0]
    const filePath = (urlPath === '/') ? '/index.html' : urlPath
    switch (path.extname(filePath)) {
      case '.html': res.setHeader('content-type', 'text/html'); break;
      case '.js': res.setHeader('content-type', 'text/javascript'); break;
      case '.json': res.setHeader('content-type', 'application/json'); break;
      case '.svg': res.setHeader('content-type', 'image/svg+xml'); break;
    }

    // Deathloom fork: never serve files outside the app folder; missing file = 404 (not an unhandled stream error)
    const full = safeJoin(__dirname, filePath)
    if (!full) {
      res.statusCode = 404
      res.end()
      return
    }
    fs.createReadStream(full)
      .on('error', () => {
        if (!res.headersSent) res.statusCode = 404
        res.end()
      })
      .pipe(res)
  })
}

const evBus = new EventEmitter()

export function onEventAnyClient<Name extends IpcEvent['name']> (
  name: Name,
  cb: (payload: IpcEventPayload<Name>) => void
) {
  evBus.on(name, cb)
}

export function sendEventTo (
  target: 'last-active' | 'any' | 'broadcast',
  event: IpcEvent
) {
  const msg = JSON.stringify(event)
  if (target === 'broadcast') {
    for (const client of websocketServer.clients) {
      client.send(msg)
    }
  } else {
    lastActiveClient.send(msg)
  }
}

// Deathloom fork: call this synchronously inside an onEventAnyClient handler to
// get a function that answers the client that sent the event (the overlay or
// the HUD window), even after async work. Falls back to the last-active client.
export function replyTo (): (event: IpcEvent) => void {
  const socket = dispatchingSocket ?? lastActiveClient
  return (event) => {
    if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
  }
}

export interface ServerEvents {
  onEventAnyClient: typeof onEventAnyClient
  sendEventTo: typeof sendEventTo
  replyTo: typeof replyTo
}
export const eventPipe = {
  onEventAnyClient,
  sendEventTo,
  replyTo
}

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/events' && req.url !== '/events?client=hud') {
    return req.destroy()
  }
  websocketServer.handleUpgrade(req, socket, head, (ws) => {
    if (req.url === '/events?client=hud') hudClients.add(ws)
    websocketServer.emit('connection', ws, req)
  })
})

export async function startServer (
  appUpdater: AppUpdater,
  logger: Logger
): Promise<number> {
  const configStore = new ConfigStore(eventPipe)

  websocketServer.on('connection', (socket) => {
    const isHud = hudClients.has(socket)
    if (!isHud) lastActiveClient = socket
    socket.on('message', (bytes) => {
      const event = JSON.parse(bytes.toString('utf-8')) as IpcEvent
      if (event.name === 'CLIENT->MAIN::used-recently') {
        if (isHud) return
        lastActiveClient = socket
      }
      dispatchingSocket = socket
      try {
        evBus.emit(event.name, event.payload)
      } finally {
        dispatchingSocket = undefined
      }
    })
    socket.on('close', () => {
      const clients = [...websocketServer.clients].filter(c => !hudClients.has(c))
      if (clients.length === 1) {
        lastActiveClient = clients[0]
        evBus.emit('CLIENT->MAIN::used-recently', { isOverlay: true })
      }
    })
    if (!isHud) {
      sendEventTo('last-active', {
        name: 'MAIN->CLIENT::log-entry',
        payload: { message: logger.history }
      })
    }
  })

  server.addListener('request', async (req, res) => {
    if (req.url === '/config') {
      res.setHeader('content-type', 'application/json')
      const resBody: HostState = {
        version: app.getVersion(),
        updater: appUpdater.info,
        contents: await configStore.load()
      }
      res.end(JSON.stringify(resBody))
    }
  })

  let port = (process.env.VITE_DEV_SERVER_URL) ? 8584 : 0
  let host = '127.0.0.1'
  // --listen=[host][:port]
  const listenOpt = process.argv.find(arg => arg.startsWith('--listen'))
  if (listenOpt) {
    const [hostArg, portArg] = listenOpt.split('=')[1].split(':')
    if (hostArg) host = hostArg
    if (portArg) port = parseInt(portArg, 10)
  }

  return new Promise((resolve, reject) => {
    server.listen({ port, host })
      .once('error', reject)
      .once('listening', () => {
        resolve((server.address() as AddressInfo).port)
      })
  })
}
