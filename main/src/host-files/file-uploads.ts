import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { app } from 'electron'
import type { Server } from 'http'
import { safeJoin } from '../request-guard'

export function addFileUploadRoutes (server: Server) {
  const uploadsPath = path.join(app.getPath('userData'), 'apt-data', 'files')

  server.addListener('request', (req, res) => {
    if (req.method !== 'GET' || !req.url?.startsWith('/uploads/')) return

    // Deathloom fork: stay inside the uploads folder; missing file = 404
    const full = safeJoin(uploadsPath, req.url.slice('/uploads/'.length).split('?')[0])
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

  server.addListener('request', (req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/uploads/')) return

    let contents = Buffer.alloc(0)
    req.on('data', (chunk) => {
      if (contents.length > 16_000_000) {
        return req.destroy()
      }
      contents = Buffer.concat([contents, chunk])
    })
    req.once('end', () => {
      const hash = crypto.createHash('md5').update(contents).digest('hex')
      const filename = `${hash}${path.extname(req.url!)}`

      fs.mkdirSync(uploadsPath, { recursive: true })
      fs.writeFileSync(path.join(uploadsPath, filename), contents)

      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ name: filename }))
    })
  })
}
