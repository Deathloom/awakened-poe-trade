// Deathloom fork: the "show while playing" HUD window loads the same page with ?hud
export const IS_HUD = new URLSearchParams(window.location.search).has('hud')
