// Deathloom fork: friendlier text for Path of Building errors in the Craft tab
export function pobError (err: string | undefined): string {
  const e = err ?? 'Path of Building did not answer.'
  if (/Unknown cmd/.test(e)) {
    return "Orbhoarder's Path of Building is older than this feature. It updates by itself: restart Orbhoarder and try again in a minute."
  }
  if (/No build loaded/.test(e)) return 'Pick an active build first (Build tab).'
  return e.replace(/^.*?ImpactServer\.lua:\d+: /, '')
}
