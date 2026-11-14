// Deathloom fork: resizable panels in the Loot Goblin window. Sizes are
// fractions (they add up to 1), saved per layout in localStorage.
import { ref, type Ref } from 'vue'

const MIN = 0.08

export function useSplit (key: string, defaults: number[]) {
  const storageKey = `deathloom.split.${key}.v1`
  let start = defaults
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (Array.isArray(saved) && saved.length === defaults.length && saved.every(n => typeof n === 'number' && n > 0)) start = saved
  } catch {}
  const sizes: Ref<number[]> = ref([...start])
  function save () {
    try { localStorage.setItem(storageKey, JSON.stringify(sizes.value)) } catch {}
  }
  // the gutter after pane i moved by deltaPx inside a container totalPx long
  function drag (i: number, deltaPx: number, totalPx: number) {
    if (!totalPx) return
    const s = [...sizes.value]
    let d = deltaPx / totalPx
    d = Math.max(MIN - s[i], Math.min(s[i + 1] - MIN, d))
    s[i] += d
    s[i + 1] -= d
    sizes.value = s
  }
  function reset () {
    sizes.value = [...defaults]
    save()
  }
  return { sizes, drag, save, reset }
}
