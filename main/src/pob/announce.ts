// Deathloom fork (S5): which PoB requests change state that every window shows.
// A reply only reaches the panel that asked; when this says yes, PobImpact also
// broadcasts MAIN->CLIENT::pob-character so the build picker, tree, tree map and
// gems panels in every other window (overlay, desktop, HUD) ask again.
// Pure so the decision is unit tested ("one window didn't update": #136, #157,
// #227, #272).

const SET_OPS = new Set(['newLoadout', 'copySet', 'deleteSet'])
const MANAGE_OPS = new Set(['rename', 'move', 'duplicate', 'delete'])

export function shouldAnnounce (name: string, payload: unknown): boolean {
  const p = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {}
  switch (name) {
    case 'CLIENT->MAIN::pob-builds':
      // build, loadout, character or player switch
      return Boolean(p.setActive || p.setLoadout || p.setCharacter) || typeof p.setPlayer === 'string'
    case 'CLIENT->MAIN::pob-edit':
      // set changes can change the active tree; a single passive / gem edit
      // only answers the panel that made it
      return Array.isArray(p.ops) && p.ops.some((o: unknown) =>
        o != null && typeof o === 'object' && SET_OPS.has((o as { op?: unknown }).op as string))
    case 'CLIENT->MAIN::pob-manage-build':
      // rename / move / delete can move or remove the active build; every op
      // changes the build list other windows show
      return MANAGE_OPS.has(p.op as string)
    default:
      return false
  }
}
