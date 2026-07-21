# Tauri Migration — Progress & Handoff Notes

> **Branch**: `feat/tauri-migration` (long-lived, parallel to `main`)
> **Last updated**: 2026-07-21
> **Status**: Core migration functionally complete and CI-green on all 3 desktop targets. Electron has been removed *from this branch only* (main keeps its own working Electron copy — see "Branching strategy" below). A round of dead-code cleanup was audited but only partially executed; see "Pending work" for the exact list.

This file exists so a fresh agent/session can pick up this work without re-deriving context from scratch. Read this fully before making changes.

---

## 1. What this project is

**Srotas WhatsApp Bot** — a multi-session WhatsApp automation desktop app:
- `server.js` + `src/**` — Node/Express/Socket.IO backend, WhatsApp via `@whiskeysockets/baileys`, SQLite (`better-sqlite3`), Gemini/OpenAI AI auto-reply, bulk campaigns, templates, quick replies.
- `frontend/` — Next.js dashboard (static export, `output: 'export'`, builds into root `public/`), served by `server.js` via `express.static`.
- Desktop shell: **being migrated from Electron (`main.js`) to Tauri v2 (`src-tauri/`)**.

## 2. Branching strategy — read this before deleting anything Electron-related

- `main` still ships Electron builds via its own `.github/workflows/release.yml` and `main.js`. **That branch is untouched by this work.**
- `feat/tauri-migration` (this branch) is where the Tauri shell was built out, in parallel, without touching `main`.
- Partway through, the user explicitly authorized removing Electron *from this branch specifically*, reasoning: "since we are on a different branch, we can remove anything related to electron as that'll be there in main branch anyway." This was executed in commit `e1c9600` — see §4.
- **Do not** re-add Electron files here, and don't worry about "losing" Electron code — it's safe in `main`'s history regardless of what happens on this branch.
- The eventual plan (not yet executed, no timeline set) is presumably to merge this branch into `main` once Tauri reaches full real-hardware parity, at which point Electron would be gone from `main` too. That merge has **not** happened and no one has scheduled it — don't assume it's imminent.

## 3. Architecture of the Tauri shell

- `src-tauri/src/lib.rs` — the whole Rust entrypoint. Key behaviors:
  - Spawns `server.js` as a **sidecar** (bundled Node.js binary + `node_modules`, not a Node-on-PATH assumption) via `tauri_plugin_shell`.
  - Shows a "splash" placeholder window immediately; watches sidecar stdout for a `SERVER_PORT=<port>` line, then closes the splash and opens the real "main" window pointed at `http://localhost:<port>` (`WebviewUrl::External`).
  - A 30s watchdog thread shows captured stdout/stderr directly in the splash window if the sidecar never reports its port (was previously an indefinite silent hang — see §5).
  - PID-file-based orphan-process recovery (`server.pid` in app data dir), single-instance lock, macOS dock hide-not-quit behavior, external-link routing through `tauri-plugin-opener`.
- `tauri.conf.json`: note `"frontendDist": "dist-placeholder"` — the **real dashboard UI is not a bundled Tauri frontend asset**. It's served live by the Node sidecar from the bundled `public/` directory (via `express.static` in `server.js`). Tauri's own `frontendDist` only backs the splash screen. This matters: to get new frontend code into a Tauri build, `public/` must be freshly rebuilt (`npm run build:ui`) before `scripts/stage-tauri-sidecar.mjs` runs — CI does this in the right order already (see `.github/workflows/tauri-build.yml`).
- `scripts/stage-tauri-sidecar.mjs` — downloads a pinned Node runtime (currently `v22.23.1`), renames it per Rust target triple for Tauri's `externalBin` convention, and stages `server.js` + `src/**` + `public/` + a production `npm ci` into `src-tauri/resources/server-app/`. Handles cross-compilation for Windows ARM64 (can't execute an ARM64 binary on the x64 CI runner, so `npm ci` runs through the host's own Node with `npm_config_arch`/`npm_config_platform` overrides so `better-sqlite3`'s prebuild-install still fetches the right target binary).
- `.github/workflows/tauri-build.yml` — 3 jobs: `build-mac` (produces both `.app` and `.dmg`), `build-windows` (x64 NSIS), `build-windows-arm64` (cross-compiled NSIS, no smoke-test possible since the CI runner can't execute ARM64 binaries at all).

## 4. Completed work (chronological, most recent first)

| Commit | What |
|---|---|
| `e1c9600` | Removed Electron from this branch (`main.js`, `release.yml`, electron-builder config/scripts/deps from `package.json`, Electron packaging jobs from `pr-check.yml` — kept its lint/test/Docker jobs). Also added `Cache-Control: no-store` to `server.js`'s static file serving (see §5, "stale WebView cache" bug). |
| `d9f6091` | Fixed a real bug: the "New/Edit Template" dialog and the image-preview lightbox in `frontend/src/app/templates.tsx` were sibling `Dialog` components. Base UI (the dialog library) only suppresses Escape on a non-topmost dialog via React-tree nesting — as siblings, both dialogs thought they were topmost and **both closed on a single Escape press**, wiping the in-progress template draft. Fixed by nesting the lightbox inside whichever dialog opens it. `campaigns.tsx` has the same lightbox JSX but is NOT affected by this specific bug (its "New Campaign" composer is a full-page view, not a popup Dialog) — see §6 for the still-unresolved report from the user about campaigns. |
| `3ec82d0` | Re-enabled macOS DMG installer (`--bundles app dmg`) in CI — was previously disabled due to earlier (unconfirmed) flakiness; re-tested clean, was just never turned back on in CI. |
| `54f2eb7` | Committed the Tauri/Electron runtime-shell-detection badge in `frontend/src/components/layout/app-shell.tsx` (checks `window.__TAURI_INTERNALS__` vs `navigator.userAgent.includes('Electron')`). This had been built and verified locally in an earlier session but never actually `git commit`ted — every CI artifact tested up to that point was silently missing this feature. |
| `ef90cb3`, `b292f84`, `29591d6`, `4d283d0`, `1cf00af`, `dfc8076` | The Windows ARM64 "stuck at Starting backend" saga — see §5, it's the single most load-bearing fix in this whole migration. |

## 5. Major bugs found & fixed this migration

1. **Windows ARM64 startup hang** (root cause of "stuck at Starting backend forever"): Node's internal module resolution throws `EISDIR: illegal operation on a directory, lstat 'C:'` on Windows ARM64 when resolving symlinks during `require()`. Fixed via `--preserve-symlinks-main` + `--preserve-symlinks` sidecar args. Confirmed on both a VMware ARM64 VM and real ARM64 hardware. **This fix has been CI-validated but the user had not yet re-confirmed it resolves the issue on real hardware as of the last check** — this is the most important open verification item, see §6.
2. **Silent indefinite hang on any sidecar startup failure**: the splash screen was fully static with no timeout, so any crash before `server.js`'s own error handlers even registered looked identical to "still starting." Fixed with the 30s watchdog (§3).
3. **ARM64 Windows CI cross-compile was fundamentally broken**: tried to literally execute a downloaded ARM64 `node.exe` on an x64 CI runner to run `npm ci` — physically impossible (no ARM64-on-x64 emulation on Windows). Fixed by running `npm ci` through the host's own Node with arch/platform env overrides.
4. **Dialog Escape-key bug** — see `d9f6091` above.
5. **Stale WebView cache masking new builds**: `express.static` had no cache headers, and since the desktop shell's WebView2/WKWebView profile persists across app *upgrades* (same `APP_USER_DATA_PATH`), installing a new build "over" an existing install could keep serving a cached `index.html` pointing at old JS bundle hashes — meaning fixes could silently appear "not applied" even though the binary was rebuilt correctly. Fixed via `Cache-Control: no-store` in `e1c9600`. **This fix only prevents future staleness — it doesn't clear whatever's already cached.** Anyone testing needs a clean uninstall + app-data-folder deletion, not just a reinstall.
6. **`wmic` deprecated on Windows 11 24H2+**: orphan-process cleanup used `wmic`, silently no-op'd on newer Windows. Replaced with `Get-CimInstance Win32_Process` via PowerShell.

## 6. Open / unresolved items — the actual next steps

These are things a fresh agent should either finish investigating or ask the user about, roughly in priority order:

1. **Real-hardware confirmation still pending** for:
   - The Windows ARM64 `--preserve-symlinks` startup fix (item 1 above) — never explicitly re-confirmed working after the second/broadened fix.
   - Whether `e1c9600`'s cache-control fix + a clean uninstall/reinstall actually restores the Tauri/Electron badge and the dialog-nesting fix in a real installed build. The user reported both "missing" in a build that was installed *over* the existing app (not a clean reinstall) — diagnosis points strongly at stale WebView cache (§5.5), but this has **not been confirmed** as the actual cause, only inferred from code review. If the user reports the badge/dialog issue *still* present after a genuinely clean reinstall of the `e1c9600`-or-later build, the cache theory is wrong and needs re-investigation.
2. **Campaigns page "window disappears" report**: the user's original bug report mentioned losing an in-progress campaign draft too, not just templates. Investigation found `campaigns.tsx`'s "New Campaign" composer is a full-page view (not a Dialog), so it should NOT be susceptible to the same Escape-double-close mechanism as templates.tsx. No root cause was found for a campaigns-specific data-loss bug. If the user reproduces this again specifically on the campaigns flow (not templates), it needs fresh investigation — don't assume it's already fixed by `d9f6091`.
3. **A real (separate, not-yet-fixed) bug found during audit, not yet actioned**: `src/ai/provider.js`'s `refreshAIConfig` export is never called anywhere. Its own comment says it should be invoked from `PUT /api/settings` to invalidate a cached AI client when the Gemini/OpenAI API key changes — but `server.js` never wires it up. Practical effect: **changing the AI API key in Settings requires an app restart to take effect**, silently. This is a genuine bug, not just dead code — flagged here separately from the cleanup list below because fixing it changes behavior rather than just removing unused code.

## 7. Pending cleanup work (audited, NOT yet executed beyond Electron removal)

Three parallel research agents audited the codebase for stale/dead code. The user was shown the consolidated list and asked to confirm before deletion; **that confirmation was interrupted by the badge/cache bug investigation and never actually given**. Do not delete these without getting explicit sign-off on this specific list first (a prior attempt to delete based on a vague "clean up everything useless" answer was correctly blocked by the permission system for being too unspecific).

### Backend (high confidence, safe)
- Delete `fix_quickreplies.js` (repo root) — one-off codegen script, zero references anywhere in the repo, and its embedded template string is itself corrupted/garbled.
- Delete `scripts/debug-logger.js` — orphaned Electron-era crash logger, never `require()`d by `main.js`, `server.js`, or anything else.
- Remove dead exports `quickReplies.getByTrigger` (`src/db/database.js:439`) and `templates.getById` (`src/db/database.js:456`) — both unused anywhere in the repo.
- `scripts/keygen.js` reimplements the exact same license-key algorithm already in `src/license/index.js` (`generateKey`), with a stale comment pointing at a path that no longer exists (`src/license.js`, moved to `src/license/index.js` long ago). Consolidate to call the real implementation instead of duplicating it.

### Frontend (high confidence, safe)
- Delete unused shadcn components (verified zero usages outside their own definition file): `frontend/src/components/ui/badge.tsx`, `chart.tsx` (356 lines — dashboard.tsx uses `recharts` directly instead), `dropdown-menu.tsx`, `scroll-area.tsx`, `separator.tsx`.
- Remove unused npm deps from `frontend/package.json`: `date-fns`, `qrcode`, `@types/qrcode` (zero imports anywhere in `frontend/src`).
- Remove dead `const radialData = ...` in `frontend/src/app/dashboard.tsx:133` (leftover from a prior Recharts implementation, superseded by a hand-rolled SVG gauge).
- Clean up unused imports (each verified to appear only on its own import line): `contacts.tsx` (`CardTitle`, `CardDescription`, `DialogFooter`), `help.tsx` (`CardHeader`, `CardTitle`, `CardDescription`), `templates.tsx` (`CardDescription`), `updates.tsx` (`CardDescription`), `page.tsx` (`AnimatePresence`), `sessions.tsx` (`MessageSquare`), `app-shell.tsx` (`toast`).
- Remove dead `frontend/src/lib/api.ts` functions: `getContactGroups`, `deleteContactGroup`, `previewMessage` — no call sites anywhere in `frontend/src`. (Low-medium risk only in the sense that the corresponding backend routes should be left alone — this is just removing the unused frontend client wrappers.)
- Remove orphaned CSS in `frontend/src/app/globals.css` — classes never applied in any JSX: `.status-online`, `.shimmer-text`, `.animate-fade-up`, `.animate-fade-in`, and their now-unused keyframes `fadeUp`, `fadeIn`, `dotPulse`, `slideInLeft`.

### Frontend (medium confidence — worth doing, slightly more judgment involved)
- Consolidate the duplicated ~30-line image-preview-lightbox JSX between `campaigns.tsx` (lines ~1093-1125) and `templates.tsx` (already extracted into a local `imagePreviewLightbox` const as part of the `d9f6091` fix) into one shared component. Needs unifying two slightly different `previewFile` state shapes (`{file?, url?, name}` vs `{url,name} | File`). Also similar duplication in the "Generate Image with AI" button/flow between the two files.
- Remove `next-themes` — its only usage (`frontend/src/components/ui/sonner.tsx`) is immediately overridden by a hardcoded `theme="dark"` prop in `frontend/src/app/layout.tsx:39`, and there's no `ThemeProvider` mounted anywhere. Actual dark/light toggling is done manually in `app-shell.tsx` via `localStorage`, fully independent of this package.
- `babel-plugin-react-compiler` devDependency is installed but unconfigured (no `experimental.reactCompiler` flag in `next.config.ts`, no babel config file referencing it) — either wire it up or remove it.
- **Not recommended for removal, just noted**: `app-shell.tsx`'s sidebar footer has an indefinitely-repeating `animate-[ping_2s..._infinite]` dot whenever auto-reply is left on. This is a deliberate UI signal, not dead code — a product/design call, not a cleanup item, even though it matches the "always-on CSS animation" pattern the user has flagged as a perf concern elsewhere in the app's history.

### Build/config (high confidence, safe)
- Delete `public_legacy/` (13 tracked files: `index.html`, `css/style.css`, `icon.ico`, `icon.png`, `js/*.js` ×10) — this is the pre-Next.js-rewrite Electron-era UI, last touched in the commit that rewrote the UI to Next.js. Zero references anywhere in current code.
- Delete untracked local duplicate-cruft files sitting in `public/` (not committed to git, just local junk from what looks like an unzip/restore "keep both" operation): all the `* 2.html`/`* 2.txt`/`* 2.ico`/`* 2.png`/`* 3.txt`-suffixed files, plus a stray `public/_next/static/dpiXvEpJYX3DKFKMLmJv6/` directory and `public/_next/static/chunks/c135d5199cdeabe7.js`. Safe to just `rm` locally, nothing to do with git.

### Build/config (medium confidence — needs verification before acting)
- `src-tauri/Cargo.toml` declares a direct `serde = { version = "1.0", features = ["derive"] }` dependency, but grep found no bare `serde::`/`use serde` or `#[derive(Serialize/Deserialize)]` anywhere in `src-tauri/src/*.rs` — only `serde_json::to_string(...)` calls, which pulls in `serde` transitively on its own. The explicit direct dependency (and its `derive` feature, which requires proc-macro compilation) may be pure dead weight. **Not yet verified with an actual `cargo check`** — do that before removing.

### Explicitly NOT findings (checked and ruled out — don't re-investigate these)
- `src-tauri/capabilities/default.json`, `entitlements-sidecar.plist`, `dist-placeholder/index.html` — all actively used, not scaffold leftovers.
- `.github/workflows/tauri-build.yml` — no dead steps, all referenced scripts exist.
- Root `.gitignore` — Tauri build-output paths (`src-tauri/target/`, `src-tauria/binaries/`, `src-tauri/resources/`, `src-tauri/.sidecar-work/`) are already correctly covered.
- `sessionManager.createClient` — looked dead from a `server.js`-only grep, but is actually called directly by `tests/sessionManager.sync.test.js` and `tests/sessionManager.race.test.js`. Not dead, don't remove.
- All root `dependencies` in `package.json` (post-Electron-removal) — every one is genuinely used somewhere in `server.js`/`src/**`.

## 8. How to build/test locally

- Backend only: `npm test` (Jest, `tests/**/*.test.js`) — fast, no external services needed.
- Full frontend build: `npm run build:ui` (rebuilds `public/` from `frontend/`).
- Tauri dev build: `cd src-tauri && npx tauri build` (requires `node scripts/stage-tauri-sidecar.mjs` to have been run first to stage the sidecar binary + resources).
- CI: push to `feat/tauri-migration` triggers both `.github/workflows/tauri-build.yml` (the real validation — 3 platform jobs) and the trimmed-down `.github/workflows/pr-check.yml` (lint/typecheck/Jest/Docker-build-check only, no more Electron packaging jobs as of `e1c9600`).
- Watching a CI run: `gh run watch <run-id> -R itsdkyp/srotas-whatsapp-bot --exit-status`.

## 9. Key file map

| Path | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | Rust entrypoint — sidecar spawn, window lifecycle, watchdog, orphan cleanup |
| `src-tauri/tauri.conf.json` | Tauri config — note `frontendDist` is just the splash, not the real UI |
| `src-tauri/capabilities/default.json` | ACL — remote origin allowlist (`http://localhost:*`), sidecar execute permission |
| `scripts/stage-tauri-sidecar.mjs` | Downloads pinned Node, stages sidecar binary + resources per target triple |
| `scripts/smoke-test-sidecar.mjs` | CI-only ABI mismatch check for `better-sqlite3` (native-target builds only) |
| `.github/workflows/tauri-build.yml` | The real CI validation — 3 platform jobs |
| `.github/workflows/pr-check.yml` | Generic lint/test/Docker check (Electron packaging jobs removed in `e1c9600`) |
| `frontend/src/app/templates.tsx` | Contains the fixed dialog-nesting bug (`imagePreviewLightbox`) |
| `frontend/src/app/campaigns.tsx` | Has the same lightbox JSX duplicated, unresolved "window disappears" report here |
| `frontend/src/components/layout/app-shell.tsx` | Tauri/Electron runtime-detection badge |
| `server.js:58` | Static frontend serving — now with `Cache-Control: no-store` |
