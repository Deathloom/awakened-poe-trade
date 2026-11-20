// Deathloom fork: notes of the active build (main: pob/BuildNotes.ts). Shared by
// the Build panel's Notes tab and the map check in the same window.
import { shallowRef } from 'vue'
import type { BuildMapProfile, BuildNotesData } from '@ipc/types'
import { Host } from '@/web/background/IPC'

export interface BuildNotesState {
  build: string
  player: string
  own: boolean
  data: BuildNotesData
  // Deathloom fork (Q4): the build's saved stats for build-aware map mod warnings
  profile?: BuildMapProfile
}

export const notesState = shallowRef<BuildNotesState | null>(null)
export const notesError = shallowRef<string | null>(null)
export const notesBusy = shallowRef(false)

let lastRequestId = 0
let listening = false

function listen () {
  if (listening) return
  listening = true
  Host.onEvent('MAIN->CLIENT::build-notes', (e) => {
    // -1: another window saved; take it if it's the same build
    if (e.requestId !== lastRequestId && !(e.requestId === -1 && e.build === notesState.value?.build)) return
    notesBusy.value = false
    if (!e.ok) { notesError.value = e.error ?? 'Unknown error'; return }
    notesError.value = null
    notesState.value = { build: e.build ?? '', player: e.player ?? '', own: Boolean(e.own), data: e.data ?? { text: '', mapMods: [], filter: '' }, profile: e.profile }
  })
}

export function loadNotes () {
  listen()
  notesBusy.value = true
  lastRequestId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::build-notes', payload: { requestId: lastRequestId, op: 'get' } })
}

export function saveNotes (data: BuildNotesData) {
  listen()
  notesBusy.value = true
  lastRequestId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::build-notes', payload: { requestId: lastRequestId, op: 'save', data: JSON.parse(JSON.stringify(data)) } })
}

// "3.29\\Witch\\My build.xml" -> "My build"
export function buildLabel (rel: string): string {
  return rel.split(/[\\/]/).pop()?.replace(/\.xml$/i, '') ?? rel
}

// a FilterBlade link (https only) or null
export function filterLink (filter: string): string | null {
  try {
    const u = new URL(filter)
    return u.protocol === 'https:' && /(^|\.)filterblade\.xyz$/i.test(u.hostname) ? u.href : null
  } catch {
    return null
  }
}
