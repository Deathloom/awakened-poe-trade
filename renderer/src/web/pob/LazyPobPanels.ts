// Deathloom fork (F4): the heavier Path of Building panels are loaded the first
// time they are shown instead of with every window, like the atlas tree map
// (atlas/LazyAtlasTreeMap.ts) and the charts (ui/LazyChart.ts). Each is its own
// chunk; the shared logic (compare.ts, gems.ts, …) stays in the main bundle.
// The chunk is a local file, so the wait is a frame or two and nothing is shown
// meanwhile (no loading or error state).
import { defineAsyncComponent } from 'vue'

export const LazyPobTreeMap = defineAsyncComponent(() => import('./PobTreeMap.vue'))
export const LazyPobGems = defineAsyncComponent(() => import('./PobGems.vue'))
export const LazyPobTree = defineAsyncComponent(() => import('./PobTree.vue'))
export const LazyBuildCompare = defineAsyncComponent(() => import('./BuildCompare.vue'))
