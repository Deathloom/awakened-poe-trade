// Deathloom fork: unit tests for pure logic (no Electron, no browser).
// Bundles each module with esbuild (from main/node_modules), stubs the few
// renderer imports they don't need, then runs the *.test.mjs files with node:test.
//   node tests/run.mjs
import { build } from '../main/node_modules/esbuild/lib/main.js'
import { readdirSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(here, '.build')
mkdirSync(out, { recursive: true })

const MODULES = {
  'request-guard': 'main/src/request-guard.ts',
  'proxy-cache': 'main/src/proxy-cache.ts',
  'trade-cache': 'renderer/src/web/price-check/trade/Cache.ts',
  'build-files': 'main/src/pob/BuildFiles.ts',
  'report-scrub': 'main/src/report-scrub.ts',
  'remote-key-store': 'main/src/remote-key-store.ts',
  'pob-pin': 'main/src/pob/pob-pin.ts',
  'pob-caps': 'ipc/pob-caps.ts',
  'play-session': 'renderer/src/web/companion/play-session.ts',
  money: 'renderer/src/web/money/money.ts',
  'settings-tools': 'renderer/src/web/settings/tools.ts',
  'search-strings': 'renderer/src/web/pob/search-strings.ts',
  sheets: 'renderer/src/web/cheats/sheets.ts',
  'build-xml': 'main/src/pob/build-xml.ts',
  'build-compare': 'renderer/src/web/pob/compare.ts',
  game: 'ipc/game.ts',
  'vendor-regex': 'renderer/src/web/pob/vendor-regex.ts',
  'game-keys': 'ipc/game-keys.ts',
  'craft-sim': 'renderer/src/web/craft/craft-sim.ts',
  changelog: 'renderer/src/web/whats-new/changelog.ts',
  'campaign-route': 'renderer/src/web/companion/campaign-route.ts',
  'bench-recipes': 'renderer/src/web/companion/bench-recipes.ts',
  'taken-paths': 'renderer/src/web/pob/taken-paths.ts',
  'craft-plan': 'renderer/src/web/craft/craft-plan.ts',
  'timeless-find': 'renderer/src/web/craft/timeless-find.ts',
  'item-regex': 'renderer/src/web/pob/item-regex.ts',
  'layout-phase': 'renderer/src/web/desktop/layout-phase.ts',
  'market-trends': 'renderer/src/web/market-history/market-trends.ts',
  'atlas-value': 'renderer/src/web/atlas/atlas-value.ts',
  gems: 'renderer/src/web/pob/gems.ts',
  'my-character': 'renderer/src/web/pob/my-character.ts',
  'gems-merged': 'renderer/src/web/pob/gems-merged.ts',
  'tree-step-logic': 'renderer/src/web/pob/tree-step-logic.ts',
  'item-defences': 'renderer/src/web/pob/item-defences.ts',
  'loadout-steps': 'renderer/src/web/pob/loadout-steps.ts',
  'market-tools': 'renderer/src/web/market-history/market-tools.ts',
  'atlas-generator': 'renderer/src/web/atlas/atlas-generator.ts',
  'atlas-tree-test': 'renderer/src/web/atlas/atlas-tree.ts',
  'patch-notes': 'renderer/src/web/patch-notes/patch-notes.ts',
  'vendor-recipes': 'renderer/src/web/companion/vendor-recipes.ts',
  'cheat-progress': 'renderer/src/web/cheats/progress.ts',
  'quest-gems': 'renderer/src/web/companion/quest-gems.ts',
  'cheat-threads': 'renderer/src/web/cheats/threads.ts',
  'cheat-fates': 'renderer/src/web/cheats/fates.ts',
  'lazy-data': 'renderer/src/web/companion/lazy-data.ts',
  'cheat-challenges': 'renderer/src/web/cheats/challenges.ts',
  'build-map-rules': 'renderer/src/web/map-check/build-map-rules.ts',
  'price-alerts': 'ipc/price-alerts.ts',
  'pace-log': 'renderer/src/web/companion/pace-log.ts',
  'char-level': 'renderer/src/web/companion/char-level.ts',
  'loot-filter': 'ipc/loot-filter.ts',
  'loot-filter-files': 'main/src/LootFilterFiles.ts',
  'lab-helper': 'renderer/src/web/companion/lab-helper.ts',
  i18n: 'renderer/src/web/i18n.ts',
  'pob-announce': 'main/src/pob/announce.ts',
  'watchlist-store': 'renderer/src/web/market-history/watchlist-store.ts',
  'build-progress': 'renderer/src/web/pob/build-progress.ts',
  'boss-readiness': 'renderer/src/web/pob/boss-readiness.ts',
  'league-recap': 'renderer/src/web/cheats/league-recap.ts',
  'gem-profit': 'renderer/src/web/market-history/gem-profit.ts',
  'bulk-sell': 'renderer/src/web/market-history/bulk-sell.ts',
  viscera: 'renderer/src/web/money/viscera.ts',
  temple: 'renderer/src/web/money/temple.ts',
  wombgift: 'renderer/src/web/money/wombgift.ts',
  'pull-diff': 'main/src/pob/pull-diff.ts',
  'board-matching': 'renderer/src/web/trade-board/matching.ts'
}

// renderer imports the tested code doesn't use at runtime
const stubs = {
  name: 'stubs',
  setup (b) {
    b.onResolve({ filter: /^@\/assets\/data$/ }, () => ({ path: 'data', namespace: 'stub' }))
    b.onResolve({ filter: /^@\/web\/client-log\/client-log$/ }, () => ({ path: 'client-log', namespace: 'stub' }))
    b.onResolve({ filter: /^@\/web\/Config$/ }, () => ({ path: 'config', namespace: 'stub' }))
    b.onResolve({ filter: /^@\/web\/background\/IPC$/ }, () => ({ path: 'ipc', namespace: 'stub' }))
    b.onResolve({ filter: /CHANGELOG\.md\?raw$/ }, () => ({ path: 'changelog-md', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
      contents: {
        data: 'export const CLIENT_STRINGS = {}',
        'client-log': 'export const TRADE_WHISPER = []; export const TRADE_BULK_WHISPER = []',
        config: 'export const AppConfig = () => ({})',
        ipc: 'export const Host = { onEvent: () => ({ abort () {} }), sendEvent () {} }',
        'changelog-md': 'export default ""'
      }[a.path],
      loader: 'js'
    }))
  }
}

for (const [name, file] of Object.entries(MODULES)) {
  await build({
    entryPoints: [join(root, file)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(out, `${name}.mjs`),
    logLevel: 'error',
    plugins: [stubs],
    tsconfigRaw: { compilerOptions: { paths: { '@ipc/*': ['../ipc/*'] } } },
    alias: { '@ipc': join(root, 'ipc') }
  })
}

// the PoE2 parser test reads the *.index.bin files, which are normally made by the vite build
const { makeIndexFiles } = await import('../renderer/src/assets/make-index-files.mjs')
makeIndexFiles()

// Deathloom fork (A2): the PoE2 parser (renderer/src/poe2, from Exiled Exchange 2)
// with its real data files. '@/...' resolves into renderer/src; the app config,
// IPC and client strings are stubbed so the parser runs outside Electron.
const renderer = join(root, 'renderer')
await build({
  entryPoints: [join(here, 'fixtures/poe2/entry.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(out, 'poe2-parser.mjs'),
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'error',
  nodePaths: [join(renderer, 'node_modules')],
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{
    name: 'poe2',
    setup (b) {
      b.onResolve({ filter: /^@\/web\/Config$/ }, () => ({ path: 'config', namespace: 'poe2-stub' }))
      b.onResolve({ filter: /^@\/web\/background\/IPC$/ }, () => ({ path: 'ipc', namespace: 'poe2-stub' }))
      b.onResolve({ filter: /client-string-loader$/ }, () => ({ path: 'strings', namespace: 'poe2-stub' }))
      b.onResolve({ filter: /^@\/web\/background\/Leagues$/ }, () => ({ path: 'leagues', namespace: 'poe2-stub' }))
      b.onResolve({ filter: /^@\/web\/i18n$/ }, () => ({ path: 'i18n', namespace: 'poe2-stub' }))
      b.onLoad({ filter: /.*/, namespace: 'poe2-stub' }, (a) => ({
        contents: {
          config: 'const cfg = { language: "en", widgets: [{ wmType: "price-check", savedAugments: {}, coreCurrency: "exalted", searchStatRange: 10 }] }\n' +
            'export const AppConfig = (type) => type ? cfg.widgets.find(w => w.wmType === type) : cfg\n' +
            'export const poeWebApi = () => "www.pathofexile.com"',
          ipc: 'export const Host = { proxy: async () => { throw new Error("offline in tests") }, onEvent () {}, sendEvent () {} }; export const MainProcess = Host',
          leagues: 'import { shallowRef } from "vue"\nexport const useLeagues = () => ({ selected: shallowRef(undefined), selectedId: shallowRef("Standard") })',
          i18n: 'export const useI18nNs = () => ({ t: (k) => k })',
          strings: `import { pathToFileURL } from 'node:url'\n` +
            `export async function loadClientStrings (lang) { return (await import(pathToFileURL(${JSON.stringify(join(renderer, 'public/data/poe2'))} + '/' + lang + '/client_strings.js').href)).default }`
        }[a.path],
        loader: 'js',
        resolveDir: join(renderer, 'src')
      }))
      b.onResolve({ filter: /^@\// }, async (a) => {
        const r = await b.resolve('./' + a.path.slice(2), { kind: a.kind, resolveDir: join(renderer, 'src') })
        return r
      })
    }
  }]
})

const tests = readdirSync(here).filter(f => f.endsWith('.test.mjs')).map(f => join(here, f))
const res = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' })
process.exit(res.status ?? 1)
