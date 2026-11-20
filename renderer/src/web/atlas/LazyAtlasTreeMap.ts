// Deathloom fork (F4): the atlas tree map (and the atlas tree data, ~170 kB) is
// loaded the first time the Atlas panel is shown instead of with every window,
// like the charts (ui/LazyChart.ts).
import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent(() => import('./AtlasTreeMap.vue'))
