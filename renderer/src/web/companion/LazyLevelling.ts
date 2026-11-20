// Deathloom fork (F4): the campaign guide and the levelling planner need the
// campaign route (campaign-route.json, ~57 kB), which is loaded the first time
// one of them is shown instead of with every window. Each wrapper loads the
// route and the component's own chunk when it is mounted and shows the
// component once both are in, so the guide never starts on an empty route (and
// never saves step 0 over the player's guide position). Like pob/LazyPobPanels.ts:
// a local file, so the wait is a frame or two and nothing is shown meanwhile.
// A failed load is tried once more (lazy-data.ts); if it still fails the panel
// says so with a Retry button, and showing the panel again tries again.
// The planner doesn't need the route to work (the hidden one in the All layout
// keeps the tree map up to date): without it, it shows act 1 and no guide points.
import { defineComponent, h, markRaw, ref, shallowRef, type Component } from 'vue'
import { loadRoute } from './campaign-route'
import { lazyOnce } from './lazy-data'

function afterRoute (name: string, load: () => Promise<{ default: Component }>, routeOptional = false) {
  const loadComponent = lazyOnce(() => load().then(m => m.default))
  return defineComponent({
    name,
    inheritAttrs: false,
    setup (_props, { attrs }) {
      const inner = shallowRef<Component | null>(null)
      const failed = ref(false)
      const tryLoad = () => {
        failed.value = false
        const route = routeOptional ? loadRoute().catch(() => null) : loadRoute()
        Promise.all([route, loadComponent()]).then(([, c]) => {
          inner.value = markRaw(c)
        }, (err: unknown) => {
          console.error(err)
          failed.value = true
        })
      }
      tryLoad()
      return () => inner.value
        ? h(inner.value, attrs)
        : failed.value
          ? h('div', { class: 'p-2 text-sm text-gray-500' }, [
              "Couldn't load this panel. ",
              h('button', { class: 'ui-btn', onClick: tryLoad }, 'Retry')
            ])
          : null
    }
  })
}

export const LazyCampaignGuide = afterRoute('LazyCampaignGuide', () => import('./CampaignGuideBody.vue'))
export const LazyPobNext = afterRoute('LazyPobNext', () => import('../pob/PobNext.vue'), true)
