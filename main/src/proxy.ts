import type { Server } from 'http'
import { app, net, session } from 'electron'
import type { Logger } from './RemoteLogger'
import { isCacheableProxyRequest, ResponseCache, type CachedResponse } from './proxy-cache'

// Deathloom fork: identify the tool on every request it forwards (GGG asks third-party
// tools to say who they are). Keeps Electron's browser string so nothing breaks.
export function lootGoblinUserAgent () {
  return `${app.userAgentFallback} Orbhoarder/${app.getVersion()} (+https://github.com/Deathloom/awakened-poe-trade)`
}

const PROXY_HOSTS = [
  { host: 'www.pathofexile.com', official: true },
  { host: 'ru.pathofexile.com', official: true },
  { host: 'pathofexile.tw', official: true },
  { host: 'poe.kakaogames.com', official: true },
  { host: 'poe.ninja', official: false },
  { host: 'www.poeprices.info', official: false },
]

const ninjaCache = new ResponseCache()

function downloadToMemory (options: Electron.ClientRequestConstructorOptions): Promise<CachedResponse> {
  return new Promise((resolve, reject) => {
    const proxyReq = net.request(options)
    proxyReq.addListener('response', (proxyRes) => {
      const headers = { ...proxyRes.headers }
      // `net.request` returns an already decoded body; the length is set when sent
      delete headers['content-encoding']
      delete headers['content-length']
      delete headers['transfer-encoding']
      // a kept copy is handed to other windows later: no cookies in it
      // (the session's own cookie jar still gets them through `net.request`)
      delete headers['set-cookie']
      const chunks: Buffer[] = []
      proxyRes.on('data', (chunk) => { chunks.push(chunk) })
      proxyRes.on('end', () => {
        resolve({
          statusCode: proxyRes.statusCode,
          statusMessage: proxyRes.statusMessage,
          headers,
          body: Buffer.concat(chunks)
        })
      })
      proxyRes.on('error', reject)
    })
    proxyReq.addListener('error', reject)
    proxyReq.end()
  })
}

export class HttpProxy {
  constructor (
    server: Server,
    logger: Logger
  ) {
    server.addListener('request', (req, res) => {
      if (!req.url?.startsWith('/proxy/')) return
      const host = req.url.split('/', 3)[2]

      const official = PROXY_HOSTS.find(entry => entry.host === host)?.official
      if (official === undefined) return req.destroy()

      for (const key in req.headers) {
        if (key.startsWith('sec-') || key === 'host' || key === 'origin' || key === 'content-length') {
          delete req.headers[key]
        }
      }

      const target = req.url.slice('/proxy/'.length)
      const requestOptions: Electron.ClientRequestConstructorOptions = {
        url: 'https://' + target,
        method: req.method,
        headers: {
          ...req.headers,
          // Deathloom fork (17 Nov 2026): GGG's sites get exactly the same browser
          // string as the "Browser" window. Cloudflare ties its check (cf_clearance)
          // to that string: a different one meant passing the check in the Browser
          // window never helped, and leagues / price checks kept failing.
          'user-agent': official ? app.userAgentFallback : lootGoblinUserAgent()
        },
        useSessionCookies: true,
        referrerPolicy: 'no-referrer-when-downgrade'
      }

      // Deathloom fork (F4a): poe.ninja's full price list is shared by all windows
      // for a few minutes instead of each one downloading it (see proxy-cache.ts)
      if (isCacheableProxyRequest(req.method, target)) {
        req.resume()
        ninjaCache.fetch(target, () => downloadToMemory(requestOptions))
          .then((cached) => {
            if (res.destroyed) return
            res.writeHead(cached.statusCode, cached.statusMessage, {
              ...cached.headers,
              'content-length': String(cached.body.byteLength)
            })
            res.end(cached.body)
          }, (err: Error) => {
            logger.write(`error [cors-proxy] ${err.message} (${host})`)
            res.destroy(err)
          })
        return
      }

      const proxyReq = net.request(requestOptions)
      proxyReq.addListener('response', (proxyRes) => {
        const resHeaders = { ...proxyRes.headers }
        // `net.request` returns an already decoded body
        delete resHeaders['content-encoding']
        res.writeHead(proxyRes.statusCode, proxyRes.statusMessage, resHeaders)
        ;(proxyRes as unknown as NodeJS.ReadableStream).pipe(res)
      })
      proxyReq.addListener('error', (err) => {
        logger.write(`error [cors-proxy] ${err.message} (${host})`)
        res.destroy(err)
      })
      req.pipe(proxyReq as unknown as NodeJS.WritableStream)
    })

    session.defaultSession.webRequest.onHeadersReceived((details, next) => {
      // Cloudflare sets cookies with Partitioned attribute, however `net.request` API
      // doesn't provide a way to specify partition key, so we simply remove it.
      const cookies = details.responseHeaders?.['set-cookie']
      if (cookies) {
        details.responseHeaders!['set-cookie'] = cookies.map(cookie => {
          return cookie.split(';')
            .filter(part => part.trim().toLowerCase() !== 'partitioned')
            .join(';')
        })
      }
      next({ responseHeaders: details.responseHeaders })
    })
  }
}
