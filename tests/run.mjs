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
  'build-files': 'main/src/pob/BuildFiles.ts',
  'report-scrub': 'main/src/report-scrub.ts',
  'remote-key-store': 'main/src/remote-key-store.ts',
  'pob-pin': 'main/src/pob/pob-pin.ts',
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
  'taken-paths': 'renderer/src/web/pob/taken-paths.ts',
  'craft-plan': 'renderer/src/web/craft/craft-plan.ts',
  'timeless-find': 'renderer/src/web/craft/timeless-find.ts',
  'item-regex': 'renderer/src/web/pob/item-regex.ts',
  'layout-phase': 'renderer/src/web/desktop/layout-phase.ts',
  'market-trends': 'renderer/src/web/market-history/market-trends.ts',
  'atlas-value': 'renderer/src/web/atlas/atlas-value.ts',
  'atlas-taken': 'renderer/src/web/atlas/atlas-taken.ts',
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
  'build-map-rules': 'renderer/src/web/map-check/build-map-rules.ts'
}

// renderer imports the tested code doesn't use at runtime
const stubs = {
  name: 'stubs',
  setup (b) {
    b.onResolve({ filter: /^@\/assets\/data$/ }, () => ({ path: 'data', namespace: 'stub' }))
    b.onResolve({ filter: /^@\/web\/client-log\/client-log$/ }, () => ({ path: 'client-log', namespace: 'stub' }))
    b.onResolve({ filter: /^@\/web\/Config$/ }, () => ({ path: 'config', namespace: 'stub' }))
    b.onResolve({ filter: /CHANGELOG\.md\?raw$/ }, () => ({ path: 'changelog-md', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
      contents: {
        data: 'export const CLIENT_STRINGS = {}',
        'client-log': 'export const TRADE_WHISPER = []; export const TRADE_BULK_WHISPER = []',
        config: 'export const AppConfig = () => ({})',
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

const tests = readdirSync(here).filter(f => f.endsWith('.test.mjs')).map(f => join(here, f))
const res = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' })
process.exit(res.status ?? 1)
