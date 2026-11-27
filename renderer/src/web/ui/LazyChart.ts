// Deathloom fork (F3): the chart library (ApexCharts, ~0.5 MB) is loaded the
// first time a chart is shown instead of with every window. Every HUD panel and
// desktop window loads the same app bundle, so this saves parsing it in windows
// that never show a chart (most of them).
import { defineAsyncComponent } from 'vue'

export default defineAsyncComponent(() => import('vue3-apexcharts'))
