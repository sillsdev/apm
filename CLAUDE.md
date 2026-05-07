# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Audio Project Manager (APM)** is a desktop + web application for managing oral Bible translation workflows (recording drafts, transcription, back translation, peer/consultant review, comprehension testing). Built with **Electron + Vite + React + TypeScript**.

## Commands

All commands use `npm` (never Yarn/PNPM). In PowerShell, chain with `;` not `&&`.

### Root (Electron app)

```powershell
npm start          # Dev mode with Electron hot reload
npm run build      # TypeCheck + electron-vite production build
npm run typecheck  # Full TS check (both main process + renderer)
npm run lint       # ESLint
npm run format     # Prettier
npm run build:win  # Windows installer
npm run build:mac  # macOS app
npm run build:linux
npm run clean      # Remove dist, out, src/renderer/dist
```

### Renderer (run from src\renderer)

```powershell
cd src\renderer; npm test                     # All Jest unit tests
cd src\renderer; npm test -- TestName         # Single test by name
cd src\renderer; npm run test:ci              # CI (verbose, single worker, no cache)
cd src\renderer; npm run test:coverage
cd src\renderer; npm run cy:open-ct           # Cypress component tests interactive
cd src\renderer; npm run cy:run-ct            # Cypress component tests headless
cd src\renderer; npm run cy:run-local         # E2E tests (requires dev server)
cd src\renderer; npm run validate             # Parallel: format + lint + typecheck + build
```

> Renderer tests **must** run from `src\renderer`, not the repo root.

## Architecture

### Layers

**Electron main process** (`src/main/`): Window management, file system, OS integration, FFmpeg, Auth0 OAuth. Key files:
- [src/main/index.ts](src/main/index.ts) — BrowserWindow creation, lifecycle
- [src/main/ipcMethods.ts](src/main/ipcMethods.ts) — IPC handler registry (file I/O, media, system info)
- [src/main/auth-service.ts](src/main/auth-service.ts) — Auth0 integration
- [src/main/normalizer.ts](src/main/normalizer.ts) — XML/audio data normalization

**Preload script** (`src/preload/`): Secure bridge. Renderer accesses Electron APIs only via `window.api` (typed as `MainAPI`). Never expose raw `fs` or `child_process` to the renderer.

**Renderer** (`src/renderer/src/`): React 19 + MUI 7 + Redux 5. Separate `package.json` with its own `node_modules` and build output. Key subdirectories:
- `components/` — ~80+ UI components
- `routes/` — Screen-level pages (e.g., `ProjectsScreen`, `PlanScreen`)
- `crud/` — Business logic for CRUD operations (AudioRecorder, WavRecorder, backups)
- `model/` — TypeScript types and Orbit.js models
- `store/` — Redux slices (auth, book, localization, orbit, paratext, upload)
- `context/` — React Context APIs (GlobalContext, TeamContext, PlanContext, PassageDetailContext)
- `business/` — Domain logic: `asr/` (speech recognition), `player/` (WaveSurfer.js), `voice/`, `localParatext/`
- `utils/` — 50+ utility modules
- `schema.tsx` — All Orbit.js record type definitions (~1300 lines, ~40 types)

### Data Layer (Orbit.js)

The app uses Orbit.js for data management with three coordinated sources:
- **Memory source** — in-memory cache, primary read target
- **IndexedDB source** — browser persistent storage
- **JSON:API source** — server sync

Core record types include: `user`, `organization`, `group`, `project`, `plan`, `passage`, `mediafile`, `activitystate`, `artifacttype`, `groupmembership`, `projectintegration`. All defined in [src/renderer/src/schema.tsx](src/renderer/src/schema.tsx).

### TypeScript Configuration

Three tsconfigs form a composite project:
- `tsconfig.json` — root composite config
- `tsconfig.node.json` — main process + preload
- `tsconfig.web.json` — renderer (path aliases: `@renderer/*`, `@model/*`)

Note: `strictNullChecks` is **disabled** in the renderer config.

### Key Dependencies

| Concern | Library |
|---|---|
| UI framework | React 19, MUI 7, Emotion |
| Routing | React Router 7 |
| State | Redux 5 |
| Data sync | Orbit.js v0.17 |
| Audio | WaveSurfer.js, FFmpeg/FFprobe (bundled static binaries) |
| Auth | Auth0 React SDK |
| HTTP | Axios |
| Dates | Luxon |
| Error tracking | Bugsnag |
| Build | electron-vite 5, Vite 6.2 |
| Unit tests | Jest |
| Component/E2E tests | Cypress (Firefox preferred) |

## Jest Testing

All Jest tests run from `src\renderer`. Use `--runInBand --watchAll=false` to avoid hanging in CI/automation.

```powershell
cd src\renderer; npm test -- <moduleName> --runInBand --watchAll=false
```

**Mocking `useGlobal`:** Real `useGlobal` returns `[value, setter]`. Use the keyed-map pattern when a hook calls it multiple times:

```ts
(useGlobal as jest.Mock).mockImplementation((key: string) => {
  const vals: Record<string, unknown> = { memory, plan, project };
  return [vals[key], jest.fn()];
});
```

**Mocking `useSelector`:** Mock `react-redux` with at least `{ useSelector: jest.fn() }`. Cast as `as unknown as jest.Mock` (not `as jest.Mock`) to avoid ts-jest type conflicts. When possible, run the real selector against a stub state object rather than hardcoding return values.

**`useOrbitData` stable references:** If a mock returns a new array literal inline on every call, any `useEffect` depending on that array will re-run every render, causing maximum-update-depth errors. Use a stable variable set in `beforeEach` and return the same reference.

**Module-level `window.api` capture:** If a module reads `window?.api` at top level, `beforeEach` assignments won't affect it after import. To test different values per test: call `jest.resetModules()`, set `window.api`, then `require` the module. Use `require('@testing-library/react/pure')` (not the main entry) for `renderHook`/`act` in that same reset cycle — the main entry registers `beforeAll`/`afterEach` hooks that fail when called inside a test.

**Barrel imports:** If the module under test imports from a barrel (e.g., `from '../utils'`) and Jest fails with "Cannot use import statement outside a module", mock the barrel: `jest.mock('../utils', () => ({ onlyWhatYouNeed: ... }))`.

**`jest.mock` placement:** Put `jest.mock(...)` calls before importing the module under test. Hoist-safe values (plain objects/constants) needed by the factory may be defined above the mock.

**Table/dialog assertions:**

- Scope row queries to `tbody` via `table.querySelector('tbody')` + `within(tbody)` — header rows make numeric indices brittle.
- Assert time values inside `tbody`, not with unscoped `screen.findByText`, to avoid false matches before the grid updates.
- For MUI `Dialog` + `DialogTitle` with `aria-labelledby`, use `within(dialog)` + partial name regex if the computed accessible name doesn't match.

## Cypress Component Testing

Build the full provider stack for every component test: `GlobalProvider`, Redux store, `OrbitContext`, and any feature contexts (`PassageDetailContext`, `UnsavedContext`, etc.). Don't stub ESM imports — use data-driven setup via providers instead.

**Navigation:** When testing components that use `usePassageNavigate`, wrap with `MemoryRouter` + `Routes` and stub `UnsavedContext.checkSavedFn` to invoke its callback immediately. `PlanTabSelect` / `PlanBar` also consume `UnsavedContext` and need the same wrapper.

**Localization in CT:** The `strings` Redux slice must have the correct `LocalizedStrings` instance for each key the component reads. Example minimal reducer:

```ts
const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  passageDetailStepComplete: new LocalizedStrings({ en: { title: 'Complete' } }),
});
```

**SVG-based components (e.g., `WorkflowStepsMobile`):** Assert on structure (`svg`, `svg g`) or wrapper labels — not `cy.contains` on step names, which are not text nodes. Dispatch a `resize` event after mount so width-driven step computation runs.

**Pagination:** Requires enough steps and a small viewport to expose prev/next controls.

**Running a single spec:**

```powershell
cd src\renderer; npm run cy:run-ct -- --spec=**/YourComponent.cy.tsx
```

Use stable DOM selectors (`id`, `data-cy`) for all assertions.

## Localization

New strings go in [localization/TranscriberAdmin-en-1.2.xliff](localization/TranscriberAdmin-en-1.2.xliff) as `<trans-unit>` entries in the correct `<group>` (ids follow `section.key`, e.g. `burrito.format`). Keep units alphabetically ordered within a group.

**Regenerating after XLIFF changes — run from `localization\bin\Debug`**, not the repo root (the tool resolves inputs as relative paths from that folder). Shortcut: `localization\Updatestrings.bat` does the `cd` for you.

The tool writes `model.tsx` and `reducers.tsx` to `localization\`, then a follow-up batch copies them to [src/renderer/src/store/localization/](src/renderer/src/store/localization/) and refreshes JSON files under `src/renderer/public/localization/`. **Do not hand-edit `model.tsx` or `reducers.tsx`** — the next tool run will overwrite them.

**Using strings in components:** use `useSelector` with a selector from [src/renderer/src/selector/selectors.tsx](src/renderer/src/selector/selectors.tsx) (e.g., `burritoSelector` → `layout: 'burrito'`). Add a new selector entry only if none of the existing sections fit.

**After regen:** run `npm run typecheck` from `src\renderer` to verify.

| Step | Action                                                                              |
| ---- | ----------------------------------------------------------------------------------- |
| 1    | Add/update `<trans-unit>` in `localization/TranscriberAdmin-en-1.2.xliff`           |
| 2    | Run `localization\Updatestrings.bat` (or `cd localization\bin\Debug` + exe)         |
| 3    | Confirm `model.tsx`, `reducers.tsx`, and JSON files updated under `src/renderer/…`  |
| 4    | `cd src\renderer; npm run typecheck`                                                |
| 5    | Use `useSelector(yourSelector)` in components                                       |

## Naming Conventions

- Use neutral, platform-agnostic names: `ProjectsScreen`, `TeamLayout`, `*View`, `*Panel`.
- **Do not** use "mobile" in file names, component names, routes, or identifiers unless the feature is strictly mobile-specific (gated by size breakpoints).

## Working Preferences

- **Implement only what is explicitly requested.** No unsolicited refactors, styling changes, performance tweaks, or behavioral alterations.
- When a question is asked, answer directly first — do not run commands or modify files unless explicitly asked.
- When scope is uncertain, ask rather than assume.

## Electron Security

- Keep `contextIsolation: true` in BrowserWindow.
- Do not use the deprecated `remote` module.
- All renderer ↔ main communication goes through typed IPC channels defined in `ipcMethods.ts` and exposed via the preload script.

## Environment Channels

`npm run devs` / `npm run qas` / `npm run prods` switch build environments. These require local env config files with secrets — do not commit secret values. Auth0 test credentials are stored in a local untracked `.env` file; never commit them.
