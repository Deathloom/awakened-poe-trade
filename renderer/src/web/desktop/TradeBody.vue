<template>
  <!-- Deathloom fork (layout review step 4): Trade tab. Everything for "I am
       trading right now": whispers and ledger, Market search, GGG's trade site.
       The trade site stays alive once opened (signed in, keeps its page). -->
  <SubTabView view="trade" :tabs="TABS">
    <template #default="{ sub }">
      <TradeCompanionBody v-if="sub === 'whispers'" fill />
      <div v-else-if="sub === 'search'" class="h-full min-h-0 rounded bg-gray-800 overflow-hidden"><MarketSearchBody /></div>
      <div v-if="siteOpened" v-show="sub === 'site'" class="h-full min-h-0"><TradeSiteBody /></div>
    </template>
  </SubTabView>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SubTabView from './SubTabView.vue'
import TradeSiteBody from './TradeSiteBody.vue'
import { useSubTab } from './view-route'
import { LazyTradeCompanionBody as TradeCompanionBody, LazyMarketSearchBody as MarketSearchBody } from '../ui/LazyBodies'

const TABS = [
  { id: 'whispers', label: 'Whispers and ledger', icon: 'fa-handshake', title: 'Trade whispers and a ledger of what you bought and sold' },
  { id: 'search', label: 'Search', icon: 'fa-search-dollar', title: 'Market search: who sells an item, cheapest first', poe1Only: true },
  { id: 'site', label: 'Trade site', icon: 'fa-store', title: "GGG's official trade site (sign in on GGG's own page; Orbhoarder never sees your login)" }
] as const
const sub = useSubTab('trade', TABS.map(t => t.id), 'whispers')
// mounted the first time it's shown, then kept
const siteOpened = ref(sub.value === 'site')
watch(sub, (s) => { if (s === 'site') siteOpened.value = true })
</script>
