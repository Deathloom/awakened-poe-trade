import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { app } from 'electron'
import type { Server } from 'http'
import { safeJoin } from '../request-guard'

// Deathloom fork: uploads are images (window background, fullscreen image); anything
// else could run as a page on the app's own origin, so only these are taken and served
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif'
}

export function addFileUploadRoutes (server: Server) {
  const uploadsPath = path.join(app.getPath('userData'), 'apt-data', 'files')

  server.addListener('request', (req, res) => {
    if (req.method !== 'GET' || !req.url?.startsWith('/uploads/')) return

    // Deathloom fork: stay inside the uploads folder; missing file = 404
    const full = safeJoin(uploadsPath, req.url.slice('/uploads/'.length).split('?')[0])
    const type = full ? IMAGE_TYPES[path.extname(full).toLowerCase()] : undefined
    if (!full || !type) {
      res.statusCode = 404
      res.end()
      return
    }
    res.setHeader('content-type', type)
    res.setHeader('x-content-type-options', 'nosniff')
    fs.createReadStream(full)
      .on('error', () => {
        if (!res.headersSent) res.statusCode = 404
        res.end()
      })
      .pipe(res)
  })

  server.addListener('request', (req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/uploads/')) return
    const ext = path.extname(req.url.split('?')[0]).toLowerCase()
    if (!IMAGE_TYPES[ext]) {
      res.statusCode = 415
      res.end()
      req.resume()
      return
    }

    let contents = Buffer.alloc(0)
    req.on('data', (chunk) => {
      if (contents.length > 16_000_000) {
        return req.destroy()
      }
      contents = Buffer.concat([contents, chunk])
    })
    req.once('end', () => {
      const hash = crypto.createHash('md5').update(contents).digest('hex')
      const filename = `${hash}${ext}`

      // async: a 16 MB write shouldn't block the main process
      fs.promises.mkdir(uploadsPath, { recursive: true })
        .then(async () => { await fs.promises.writeFile(path.join(uploadsPath, filename), contents) })
        .then(() => {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ name: filename }))
        }, () => {
          res.statusCode = 500
          res.end()
        })
    })
  })
}
