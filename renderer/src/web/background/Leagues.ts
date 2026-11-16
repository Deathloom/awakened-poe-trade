import { computed, shallowRef, readonly, watch } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { AppConfig, poeWebApi, type Config } from '@/web/Config'
import { Host } from './IPC'
import { pickDefaultLeague } from '@ipc/game'

// pc-ggg, pc-garena
export const PERMANENT_SC = ['Standard', '標準模式']
const PERMANENT_HC = ['Hardcore', '專家模式']

interface ApiLeague {
  id: string
  event?: boolean
  rules: Array<{ id: string }>
}

interface League {
  id: string
  isPopular: boolean
}

export const useLeagues = createGlobalState(() => {
  const isLoading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  const tradeLeagues = shallowRef<League[]>([])

  const selectedId = computed<string | undefined>({
    get () {
      return (tradeLeagues.value.length)
        ? AppConfig().leagueId
        : undefined
    },
    set (id) {
      AppConfig().leagueId = id
    }
  })

  const selected = computed(() => {
    const { leagueId } = AppConfig()
    if (!tradeLeagues.value || !leagueId) return undefined
    const listed = tradeLeagues.value.find(league => league.id === leagueId)
    return {
      id: leagueId,
      realm: AppConfig().realm,
      isPopular: !isPrivateLeague(leagueId) && Boolean(listed?.isPopular)
    }
  })

  async function load () {
    isLoading.value = true
    error.value = null

    try {
      if (AppConfig().game === 'poe2') {
        // Deathloom fork: PoE2 mode. The trade2 list has no rules, so pick by name
        // (same endpoint Exiled Exchange 2 uses)
        const response = await Host.proxy(`${poeWebApi()}/api/trade2/data/leagues`)
        if (!response.ok) throw new Error(JSON.stringify(Object.fromEntries(response.headers)))
        const leagues: { result: Array<{ id: string }> } = await response.json()
        tradeLeagues.value = leagues.result.map(league => ({ id: league.id, isPopular: true }))
        if (!tradeLeagues.value.some(league => league.id === selectedId.value)) {
          selectedId.value = pickDefaultLeague(tradeLeagues.value.map(league => league.id))
        }
        return
      }

      const response = await Host.proxy(`${poeWebApi()}/api/leagues?type=main&realm=pc`)
      if (!response.ok) throw new Error(JSON.stringify(Object.fromEntries(response.headers)))
      const leagues: ApiLeague[] = await response.json()

      tradeLeagues.value = leagues
        .filter(league =>
          !PERMANENT_HC.includes(league.id) &&
          !league.rules.some(rule => rule.id === 'NoParties' ||
            (rule.id === 'HardMode' && !league.event)))
        .map(league => {
          return { id: league.id, isPopular: true }
        })

      const leagueIsAlive = tradeLeagues.value.some(league => league.id === selectedId.value)
      if (!leagueIsAlive && !isPrivateLeague(selectedId.value ?? '')) {
        if (tradeLeagues.value.length > 1) {
          const TMP_CHALLENGE = 1
          selectedId.value = tradeLeagues.value[TMP_CHALLENGE].id
        } else {
          const STANDARD = 0
          selectedId.value = tradeLeagues.value[STANDARD].id
        }
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isLoading.value = false
    }
  }

  // Deathloom fork: PoE2 mode. Switching game swaps the league list; each game
  // keeps the league picked last time (Settings → General sets leagueId)
  // config can still be empty while the app starts
  watch(() => (AppConfig() as Config | null)?.game, (game, prev) => {
    if (!prev || game === prev) return
    tradeLeagues.value = []
    load()
  })

  return {
    isLoading,
    error,
    selectedId,
    selected,
    list: readonly(tradeLeagues),
    load
  }
})

function isPrivateLeague (id: string) {
  if (id.includes('Ruthless')) {
    return true
  }
  return /\(PL\d+\)$/.test(id)
}
