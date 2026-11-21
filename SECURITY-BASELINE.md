# Orbhoarder security baseline

What Orbhoarder must keep true, how each item is checked, and its status. Sources: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), the parts of [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) Level 1 that apply to a desktop app (secrets, input validation, network, updates), and [OpenSSF Scorecard](https://scorecard.dev/).

Status: ✅ done · ⚠️ accepted / open (reason given) · Last full review: 2026-11-14 (v1.0.74).

**Automated** (`.github/workflows/security.yml`, every PR, push to master and weekly): npm audit fails on high/critical in shipped dependencies; Electronegativity fails on high/critical findings; renderer type-check, lint and build. `scorecard.yml` publishes OpenSSF Scorecard results to the Security tab.

## 1. Electron windows (Electron checklist)

| # | Item | Status | Where |
|---|------|--------|-------|
| 1.1 | Electron kept current (security fixes) | ✅ 45.3.2 (latest at review) | `main/package.json`; Dependabot + weekly upstream check |
| 1.2 | `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on every window, stated explicitly | ✅ | Overlay, HUD, Desktop windows |
| 1.3 | No preload scripts in app windows; webviews get theirs removed | ✅ | `safe-open.ts` `hardenWebview`, `trade-tab.ts` |
| 1.4 | `<webview>`: sandboxed, `webSecurity` on, no insecure content, only http(s) sources; trade tab only GGG's trade site, Lab tab only poelab.com, each in its own session | ✅ | `hardenWebview`, `prepareTradeWebview` |
| 1.5 | Web pages inside the app get no browser permissions (camera, mic, notifications, …) | ✅ | `denyWebviewPermissions` (default session), trade and lab tab sessions |
| 1.6 | App windows can't navigate away from the app's own pages; popups denied | ✅ | `lockToAppPages`, `guardTradeWebview` |
| 1.7 | `shell.openExternal` only with http(s) links (other schemes can start programs) | ✅ | `openWebLink`; remaining direct calls use fixed URLs |
| 1.8 | Content-Security-Policy on app pages | ✅ scripts only from the app (`script-src 'self'`), no plugins, `base-uri`/`form-action` self, no framing. Styles, images and connections stay open (Vue inline styles, poecdn images, WebSocket); tighten later | `server.ts` `APP_CSP` |
| 1.9 | `allowRunningInsecureContent: false`, `webSecurity` not disabled anywhere | ✅ | all windows |

## 2. Local server (renderer ↔ main)

| # | Item | Status | Where |
|---|------|--------|-------|
| 2.1 | Listens on 127.0.0.1 only by default | ✅ | `server.ts` |
| 2.2 | Requests and WebSocket upgrades from other web pages refused (Host + Origin check, blocks CSRF and DNS rebinding) | ✅ | `request-guard.ts` |
| 2.3 | Phone link ("Phone or other devices"): other devices need the key, decided by the connection's address (not the Host header); they can't change settings, folders, sign-in, phone access or price alerts, or send input to the game, and never become the window that gets the price check's item text | ✅ | `request-guard.ts` `isLoopbackAddress`, `allowedFromOtherDevice`; `server.ts` (last-active window) |
| 2.4 | Price alerts: checked on the shared poe.ninja download (no extra requests), sent only to windows connected to the local server (this PC, a paired phone); input validated in main; stored in `apt-data/price-alerts.json` | ✅ | `ipc/price-alerts.ts`, `PriceAlerts.ts` |

## 3. Secrets (ASVS V6/V8)

| # | Item | Status |
|---|------|--------|
| 3.1 | No secrets in the repo or in the installer | ✅ |
| 3.2 | GitHub sign-in token kept by the OS (Windows Credential Manager), not in config files or logs | ✅ |
| 3.3 | Sign-ins (trade site tab, incl. Steam / Epic / Xbox / PlayStation) happen on the provider's own pages in an isolated session; Orbhoarder never reads passwords. Same rule for the planned Discord / Steam friend sign-in | ✅ |
| 3.4 | Logs and error reports don't include tokens | ✅ (review on every new sign-in feature) |
| 3.5 | Phone link key kept with Windows' own encryption (Electron safeStorage / DPAPI, this Windows user only); plain file only where the OS offers none | ✅ `remote-key.ts`, `remote-key-store.ts` |

## 4. Input validation (ASVS V5)

| # | Item | Status |
|---|------|--------|
| 4.1 | PoB code / build import: only allowed hosts, size limit | ✅ `PobImport.ts` (`isAllowedImportUrl`, `MAX_IMPORT_BYTES`) |
| 4.2 | Files from friends' builds (Pull) treated as data, never run | ✅ |
| 4.3 | Clipboard item text parsed as text only | ✅ |
| 4.4 | Loot filter add-on (Q10): this PC only (refused from phones); only `.filter` files directly in Documents\My Games\Path of Exile[ 2] (real paths, links out refused), 8 MB cap; writes only `<his filter> + Orbhoarder.filter`, never over a file Orbhoarder didn't make, never through a link; names in quotes checked (no quotes, line breaks, `#`) | ✅ `LootFilterFiles.ts`, `ipc/loot-filter.ts`, `request-guard.ts` |

## 5. Network (ASVS V9)

| # | Item | Status |
|---|------|--------|
| 5.1 | HTTPS only for every remote call | ✅ |
| 5.2 | GGG requests rate-limited and send `User-Agent: Orbhoarder/<version>` | ✅ |
| 5.3 | poe.ninja: economy endpoints only, cached, via our own published JSON (their terms) | ⚠️ in progress (atlas "what pays", step 3) |

## 6. Updates and releases

| # | Item | Status |
|---|------|--------|
| 6.1 | Updates only from this repo's GitHub releases over HTTPS (electron-updater checks the SHA-512 in `latest.yml`) | ✅ |
| 6.2 | Release only publishes when installer and `latest.yml` are both present | ✅ `release.yml` |
| 6.3 | Workflow inputs passed via `env`, never pasted into scripts (injection) | ✅ `release.yml` |
| 6.5 | Orbhoarder's Path of Building comes from a pinned commit of the PoB fork (`main/src/pob/pob-pin.ts`), every file checked against that commit's manifest (SHA-1) and the source prefix; a push to the PoB fork reaches players only after a PR here moves the pin | ✅ `PobDownload.ts`, `pob-pin.yml` |
| 6.4 | Windows code signing | ⚠️ not signed (costs money; SmartScreen warns on first install). Each installer has a build provenance attestation (#173: `gh attestation verify <file> -R Deathloom/awakened-poe-trade`); stable only from master. Free option to look at: SignPath Foundation (open-source signing). |

## 7. Supply chain (OpenSSF Scorecard)

| # | Item | Status |
|---|------|--------|
| 7.1 | GitHub Actions pinned to full commit SHAs | ✅ build, release, security, scorecard, PoB pin workflows |
| 7.2 | Workflows run with least `permissions` | ✅ |
| 7.3 | Dependabot alerts and updates on | ✅ |
| 7.4 | Branch protection on master (ruleset "protect master") | ✅ |
| 7.5 | Lockfiles committed; CI uses `npm ci` | ✅ |

## 8. Accepted advisories (build tools only, nothing shipped)

Reviewed 2026-11-14. Re-check when the weekly run warns.

- **renderer**: 13 moderate in eslint tooling (typescript-eslint ≤ 8.72.2, eslint-plugin-vue, @vue/eslint-config-*, minimatch). No fixed version released yet; lint runs only on the developer's machine and CI.
- **main**: 6 moderate, minimatch ReDoS inside electron-builder (`@electron/universal`, `app-builder-lib`). Only ever given our own build globs.

## 9. Game rules (not security, but checked the same way)

Every feature: one action per key press, nothing moves the mouse or reads the screen or game memory, no game client changes, trade/API requests rate-limited, not-affiliated notice shown. See the Notion page "Orbhoarder: GGG rules alignment".
