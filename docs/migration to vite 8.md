# Migration to Vite 8

The migration is done and working on Vite 8.3.1, Electron 43.7.5 and electron-builder 26.17.0. Jest and Cypress all pass. One Playwright Electron test still fails; details below. Nothing is committed.

The branch changed during the session: the reflog shows a checkout from `develop` to `release-4-7`, which I didn't do. Both point at the same commit (0ce880b), so all changes are uncommitted on `release-4-7`.

## Layout

- **Root package = Electron app.** `vite.config.mts` uses `vite-plugin-electron` with the renderer root set to `./src`. Build output goes to `dist/` and `dist-electron/{main,preload}.js`. `electron-builder.json5` packages to `release/<version>/`.
- **`electron/main`, `electron/preload`** were `src/main` and `src/preload`.
- **`src/` package = web app.** It is the old `src/renderer`, moved whole, so its renderer code now lives in `src/src/`. It builds on its own to `src/dist/` and owns Jest and Cypress. Moving it whole kept every relative path inside it valid.
- File moves were done with `git mv`, so git records them as renames and history follows. I also updated the path references in CI, Docker, env-config, the localization batch file, VS Code configs, docs and the `.cursor` rules.

## Results

| Check                                                  | Result                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Typecheck (root node + web, and `src` strict)          | pass                                                               |
| Lint                                                   | 0 errors; warnings are in untouched files                          |
| Jest                                                   | 245 suites, 1850 passed, 3 skipped (same as before)                |
| Cypress CT, full suite (Cypress 16)                    | 49 specs, 569 passing, 4 pending (skipped on purpose in the specs) |
| Cypress e2e (Auth0 login on the Vite 8 dev server)     | pass                                                               |
| Web build and preview in Chrome                        | loads and redirects to Auth0                                       |
| Electron build, `npm start` dev mode, unpacked package | app boots, restores session, syncs                                 |
| Localization updater                                   | writes to the new paths; `model.tsx` and `reducers.tsx` unchanged  |
| Playwright Electron e2e                                | **2 of 3 pass**                                                    |

## Changes you should know about

- **Chunk-order fix:** Rolldown (Vite 8's bundler) split the renderer into chunks that import each other, and the app crashed on startup with `So is not a function`. `strictExecutionOrder: true` in both Vite configs fixes it.
- **Cypress 16 fallout:** Cypress 16 removed `Cypress.env()`, so I moved `@cypress/grep` from 4.1.1 to 7.0.0. The `cy:*` scripts now use `--expose grepTags=…` instead of `--env`, and `smokeSpecs.cjs` generates the new form.
- **Secrets were being packaged:** the old `app.asar` contained the entire repo, including `env-config/.env.*` and the Auth0 variable files. electron-builder was reading the `package.json` `"build"` block and ignoring `electron-builder.yml`. The new config packs only the build output. Everything outside the asar (help, localization, migration, ffmpeg/ffprobe/keytar) matches the old package. If you've shipped installers built from this setup, check what they exposed.
- **Why Cypress "couldn't run" before:** the Claude Code session sets `ELECTRON_RUN_AS_NODE=1`, which also broke `electron .` and the packaged exe. Prefixing commands with `env -u ELECTRON_RUN_AS_NODE` fixes it. I've corrected my saved note.
- **Local husky hook:** your husky hook in `.git/hooks` still pointed at `src/renderer`. I reinstalled it so it points at `src/`.

## Decision for you: the failing Playwright test

The "creates a team … and goes offline" test clicks "Go Offline" and waits for the app to quit and relaunch. Instead, the app switches to offline in place: the button reads "Go Online", nothing errors, and the `relaunchApp()` step never runs. The desktop app itself works.

I couldn't tell whether this is new. The pre-migration build, run in a temporary worktree, failed at login both times before reaching that step. The test was last updated 2026-07-06, and several changes to the offline flow have landed since. Please run `npm run test:e2e` yourself. If the old build also switches in place, the test needs updating rather than the build.

## Commands

- Electron: `npm start`, `npm run build`, `npm run build:win` (root)
- Web: `cd src; npm run build`
- Tests: `cd src; npm test`, `cd src; npm run cy:run-ct`

The build output (`dist`, `dist-electron`, `release`, `src/dist`) is left in place and gitignored.
