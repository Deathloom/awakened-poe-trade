import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { makeIndexFilesPlugin } from './src/assets/vite-plugin-make-indexes'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'esnext',
    assetsInlineLimit: 0
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'webview'
        }
      }
    }),
    makeIndexFilesPlugin()
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@ipc', replacement: path.resolve(__dirname, './src/../../ipc') },
      // Deathloom fork (F4): vuedraggable's UMD build require()s 'vue', which
      // resolves to the full build with the template compiler (~70 kB). All
      // templates are compiled at build time (.vue files), so the runtime build is enough.
      { find: /^vue$/, replacement: 'vue/dist/vue.runtime.esm-bundler.js' }
    ]
  },
  server: {
    // Deathloom fork: the What's new popup reads ../CHANGELOG.md
    fs: { allow: ['..'] },
    proxy: {
      '^/(config|uploads|proxy)': { target: 'http://127.0.0.1:8584' },
      '/events': { ws: true, target: 'http://127.0.0.1:8584' }
    }
  }
})
