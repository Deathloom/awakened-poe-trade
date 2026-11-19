// Deathloom fork (20 Nov 2026): shared price helpers for the Market tool tabs
import { computed } from 'vue'
import { usePoeninja, type NinjaListing } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'

export function useMarket () {
  const ninja = usePoeninja()
  const leagues = useLeagues()
  const league = computed(() => leagues.selectedId.value)
  const all = computed<NinjaListing[]>(() => ninja.dbVersion.value >= 0 ? ninja.allItems() : [])
  const divine = computed(() => ninja.xchgRate.value)
  // currency-like items by exact name (no variant), first listing wins
  const itemIndex = computed(() => {
    const m = new Map<string, NinjaListing>()
    for (const it of all.value) {
      if (it.ns === 'ITEM' && !it.variant && !m.has(it.name)) m.set(it.name, it)
    }
    return m
  })
  function itemPrice (name: string): number | null {
    if (name === 'Chaos Orb') return 1
    return itemIndex.value.get(name)?.chaos ?? null
  }
  function money (chaos: number) {
    const d = divine.value
    if (d && Math.abs(chaos) >= d) return `${(chaos / d).toFixed(1)} div`
    return Math.abs(chaos) >= 10 ? `${Math.round(chaos)} c` : `${Math.round(chaos * 10) / 10} c`
  }
  function open (url: string) { window.open(url) }
  return { ninja, league, all, divine, itemIndex, itemPrice, money, open }
}
