// Deathloom fork (F4): the campaign guide and the levelling planner need the
// campaign route (campaign-route.json, ~57 kB), which is loaded the first time
// one of them is shown instead of with every window. Each component waits for
// the route, so it never starts on an empty route (and never saves step 0 over
// the player's guide position). Like pob/LazyPobPanels.ts: a local file, so the
// wait is a frame or two and nothing is shown meanwhile. A failed load is tried
// once more; after that, showing the panel again tries again.
import { defineAsyncComponent, type Component } from 'vue'
import { loadRoute } from './campaign-route'

function afterRoute (load: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader: () => loadRoute().then(load),
    onError (_err, retry, fail, attempts) {
      if (attempts <= 1) setTimeout(retry, 300)
      else fail()
    }
  })
}

export const LazyCampaignGuide = afterRoute(() => import('./CampaignGuideBody.vue'))
export const LazyPobNext = afterRoute(() => import('../pob/PobNext.vue'))
