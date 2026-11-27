// Deathloom fork: adds PoE2 items and stats that Exiled Exchange 2 has not shipped yet.
//
// The PoE2 data in renderer/public/data/poe2/en is a copy of Exiled Exchange 2's
// generated data. When the game patches before EE2 updates, missing entries go in
// tools/poe2-additions/*.ndjson (checked against the PoE2 trade site's
// /api/trade2/data/items and /stats lists). Run this after every EE2 data refresh:
//
//   node tools/poe2-additions.mjs
//
// It appends only what the data files lack: an item is skipped when its
// namespace + refName already exists, a stat when its ref or any trade id already
// exists. So once EE2 ships an entry, EE2's own line wins and ours is dropped.
// Run it twice and nothing changes.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../renderer/public/data/poe2/en')
const addDir = path.join(here, 'poe2-additions')

const readLines = (file) => fs.readFileSync(file, 'utf-8').split('\n').filter(line => line.trim())

function append (file, lines) {
  if (!lines.length) return
  let text = fs.readFileSync(file, 'utf-8')
  if (!text.endsWith('\n')) text += '\n'
  fs.writeFileSync(file, text + lines.join('\n') + '\n')
}

function addItems () {
  const file = path.join(dataDir, 'items.ndjson')
  const have = new Set(readLines(file).map(line => {
    const item = JSON.parse(line)
    return `${item.namespace}::${item.refName}`
  }))
  // lines of a unique with several bases stay together (the lookup reads them in a row)
  const out = []
  for (const line of readLines(path.join(addDir, 'items.ndjson'))) {
    const item = JSON.parse(line)
    if (!have.has(`${item.namespace}::${item.refName}`)) out.push(line)
  }
  append(file, out)
  return out.length
}

function statIds (stat) {
  return Object.values(stat.trade?.ids ?? {}).flat().map(id => id.split('|')[0])
}

function addStats () {
  const file = path.join(dataDir, 'stats.ndjson')
  const refs = new Set()
  const ids = new Set()
  for (const line of readLines(file)) {
    const entry = JSON.parse(line)
    for (const stat of ('stats' in entry) ? entry.stats : [entry]) {
      refs.add(stat.ref)
      for (const id of statIds(stat)) ids.add(id)
    }
  }
  const out = []
  for (const line of readLines(path.join(addDir, 'stats.ndjson'))) {
    const stat = JSON.parse(line)
    if (refs.has(stat.ref) || statIds(stat).some(id => ids.has(id))) continue
    out.push(line)
  }
  append(file, out)
  return out.length
}

const items = addItems()
const stats = addStats()
console.log(`poe2 additions: ${items} item lines, ${stats} stat lines added`)
