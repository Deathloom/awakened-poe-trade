// Deathloom fork: rebuild electron-overlay-window's Windows part from the patched
// source (build/electron-overlay-window+4.1.0.patch) so the overlay can watch
// "Path of Exile" and "Path of Exile 2" at once and follow the focused game.
// The package ships a prebuilt .node that node-gyp-build would load instead, so
// the fresh build replaces it. Runs after patch-package (npm postinstall).
// Not Windows: nothing to do (the app keeps the stock one-title behaviour).
// A failed build keeps the stock binary; Orbhoarder then relaunches itself when
// the other game starts (fallback). In CI a failed build fails the install.
import { spawnSync } from 'node:child_process'
import { copyFileSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..', 'node_modules', 'electron-overlay-window')
const prebuilt = join(pkg, 'prebuilds', 'win32-x64', 'electron-overlay-window.node')
const built = join(pkg, 'build', 'Release', 'overlay_window.node')
const inCI = Boolean(process.env.CI)

function fail (msg) {
  if (inCI) {
    console.error(`[overlay-native] ${msg}`)
    process.exit(1)
  }
  console.warn(`[overlay-native] ${msg}; keeping the stock overlay binary (one game title, relaunch fallback)`)
  process.exit(0)
}

if (process.platform !== 'win32' || process.arch !== 'x64') process.exit(0)
if (process.env.ORBHOARDER_SKIP_OVERLAY_NATIVE) process.exit(0)
if (!existsSync(prebuilt)) fail(`prebuilt binary not found at ${prebuilt}`)

const gyp = process.env.npm_config_node_gyp
const cmd = gyp ? [process.execPath, [gyp, 'rebuild']] : ['npx', ['--yes', 'node-gyp', 'rebuild']]
const res = spawnSync(cmd[0], cmd[1], { cwd: pkg, stdio: 'inherit', shell: !gyp })
if (res.status !== 0 || !existsSync(built)) fail('node-gyp rebuild failed')

// self-test in a child process: the fresh binary loads and says it matches a
// title list (loading it here would lock the file on Windows, so build/ couldn't
// be removed afterwards)
const probe = spawnSync(process.execPath, ['-e',
  'const m = require(process.argv[1]); process.exit(m.multiTitle === true && typeof m.start === "function" ? 0 : 3)',
  built], { stdio: 'inherit' })
if (probe.status === 3) fail('rebuilt binary is missing multiTitle')
if (probe.status !== 0) fail('rebuilt binary does not load')

copyFileSync(built, prebuilt)
// leftover build files are only clutter; never fail the install over them
try { rmSync(join(pkg, 'build'), { recursive: true, force: true }) } catch (err) { console.warn(`[overlay-native] could not remove build/: ${err.message}`) }
console.log('[overlay-native] electron-overlay-window rebuilt with the two-title patch')
