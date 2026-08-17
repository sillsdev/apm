---
applyTo: 'src/renderer/src/**'
---

# Renderer Stack Guide

## Scope

- These notes cover the React renderer that lives under `src/renderer/src`. They assume the repo-level onboarding file has already been read.
- Primary goals: explain how control flows from the DOM bootstrap through auth, routing, Orbit data sources, Redux slices, and domain contexts; highlight platform differences (Electron vs web) and offline support.

## Startup Flow

- Entry point is `main.tsx`. It imports the Orbit `coordinator`/`memory` singletons from `schema.tsx`, probes the platform (`window.api` for Electron), primes local storage (fingerprint, home folder), and restores IndexedDB backups when running on desktop.
- Once prerequisites resolve, `main.tsx` renders `Root` inside `GlobalProvider`. The initial `GlobalState` is composed here, so add new global flags/fields in this file and `GlobalContext.tsx` together.
- `Root` composes the long-lived providers: the Orbit `DataProvider`, the Redux store (`store/index.tsx` combines all slices), and the auth renderer (Electron uses `TokenChecked` directly, web wraps it in Auth0).

## Auth and Platform Layers

- `TokenProvider` (`context/TokenProvider.tsx`) is the primary auth context. On the web it talks to Auth0 via `@auth0/auth0-react`; in Electron it reaches the preload bridge through the typed `MainAPI` (`window.api`).
- Tokens refresh and profile hydration happen inside `TokenProvider`. When you need authenticated requests, pull the token from this context instead of re-implementing refresh logic.
- `ErrorManagedApp` wraps the React tree inside Bugsnag (if configured) and a custom `ErrorBoundary` so renderer crashes are captured in both web and desktop builds.

## State Management Stack

- **GlobalContext**: central app session state (organization/project selection, connectivity flags, snack messages). Use the `useGlobal`/`useGetGlobal` helpers for reads/writes; avoid storing derived UI state here.
- **Orbit Memory / Coordinator**: defined in `schema.tsx`. Orbit models describe every backend record type, and the coordinator orchestrates JSON:API sync + IndexedDB backup. Use the CRUD helpers in `src/renderer/src/crud` and hooks like `useOrbitData` to query/update instead of hitting Orbit directly.
- **Redux Store**: lives in `store/index.tsx` and is mostly for view-model slices (localization strings, upload workflow, auth UI helpers, import/export state). Prefer adding to Redux only if state is not a raw Orbit record and must be shared across distant components.
- **Feature Contexts**: `UnsavedContext`, `HotKeyContext`, `PlanContext`, etc., layer on top of Global/Redux for specialized concerns. Check existing context implementations before introducing new top-level providers.

## Data Synchronization & Offline Support

- `DataChanges` is mounted at the top of `App`. It monitors Orbit sources, schedules syncs (`useInterval`), and triggers offline backups (`electronExport`) when running in Electron.
- Sync cadence is configurable per-user via hot-key preferences; `DataChanges` reads that from the Orbit user record. Any new background fetch should respect the busy flags (`remoteBusy`, `importexportBusy`, `anySaving`) to avoid clashing with existing queues.
- IndexedDB migrations/backups are handled in `schema.tsx`. If you add models or attributes, update the schema and consider whether migration steps are needed for the backup cache.

## UI Composition

- `App.tsx` layers providers, then renders the router tree from `routes/NavRoutes.tsx`. Routes are guarded by the `PrivateRoute` HOC, so authentication-aware screens should live under `routes/` and be wrapped there.
- The MUI theme is defined once in `App.tsx`. Keep component-level overrides local unless the change is broadly shared.
- Components under `components/`, `routes/`, and `burrito/` receive data primarily via hooks (Orbit, Redux selectors, contexts). Follow existing patterns (e.g., selectors in `store/*`, CRUD hooks) instead of threading props down many levels.

## Utility Layer

- Shared helpers live in `utils/`; prefer these over writing ad hoc logic so behavior stays consistent between features and tests.
- Platform helpers: `dataPath`, `execFolder`, `launch`, `exitElectronApp`, and `useCheckOnline` wrap Electron IPC and environment quirks—use them instead of touching `window.api` or `localStorage` directly.
- Orbit and persistence: `waitForIt`, `resetData`, `rememberCurrentPassage`, and hooks like `useProjectsLoaded` coordinate with the coordinator and IndexedDB. When adding polling or async retries, copy the existing patterns (e.g., `useInterval`, `waitForIt`).
- Formatting and domain logic: utilities such as `refMatch`, `getWhereis`, `localize*`, and `burritoMetadata` encode translation workflow rules; reuse them when building new UI around scripture references, localization, or Burrito metadata.
- Hooks in `utils/` (`useDebounce`, `useProjectPermissions`, `useTraceUpdate`, `useAudioAi`, etc.) are already wired to contexts and Redux. Import these to avoid duplicating selectors or context plumbing.

## Routes & Navigation

- `routes/NavRoutes.tsx` is the single source of truth for page navigation. It uses `createHashRouter` in Electron (so deep links survive across restarts) and `createBrowserRouter` on the web; add new screens here so both platforms stay aligned.
- Most protected screens are wrapped by the `PrivateRoute` HOC (`../hoc/PrivateRoute`) before being inserted into the router tree. This gate checks token state via `TokenProvider`, so reuse the same pattern when adding authenticated pages.
- Use helpers from `utils/` when redirecting: `useMyNavigate` persists deeplinks, while `StickyRedirect` queues a redirect until state settles (e.g., `TeamScreen` when it auto-opens a plan). Direct `useNavigate` calls can break offline or developer flows.
- Route components under `routes/` generally own page-level orchestration and hand off to feature-specific providers (e.g., `TeamScreen` wraps `TeamProvider`, Burrito routes share hooks like `useBurritoAlign`). Keep heavy data logic in contexts or CRUD hooks so screens remain declarative.
- Offline and account management flows (`Access.tsx`, `accessActions.ts`, `Logout.tsx`) coordinate closely with `TokenProvider` and global flags. When touching login/logout navigation, make sure the LocalKey values and Redux clean-state actions are updated so `NavRoutes` redirects properly.

## Redux Store Modules

- All Redux slices live in `store/` and are wired up in `store/index.tsx`. Add a new slice only when you need cross-component view state that does not belong in Orbit or a feature context.
- Each subfolder follows the same contract: `types.tsx` declares action types and state interfaces, `actions.tsx` houses thunks or action creators, `reducers.tsx` mutates state, and `*CleanState.ts` files define resettable defaults. Reuse these clean-state factories when clearing UI state on logout or project switches.
- Existing slices cover localization strings, paratext integration, file uploads/export (with Electron-specific helpers in `importexport/electronExport.tsx`), authenticated user metadata, and transient Orbit flags. Review adjacent slices before adding new state to avoid drift.
- Prefer dispatching exported action creators (`actions.tsx`) instead of constructing plain objects; many actions encapsulate side effects (thunks) such as API calls or Orbit updates.

## Domain Models

- Orbit record typings and supporting DTOs live in `model/`. Each file mirrors a JSON:API resource (e.g., `project.tsx`, `passage.tsx`, `organization.tsx`) or a domain helper (e.g., `roleNames.ts`, `workflowStep.tsx`). Import these types when working with Orbit records to keep transforms type-safe.
- For composite data sets (e.g., `SectionArray`, `wfSaveRec`, `projData`), consult their constructors before shaping new payloads—these utilities normalize IDs, relationships, and derived fields to match backend expectations.
- IPC bindings for Electron renderer ↔ main communication are typed in `model/main-api.ts`; use the exposed interfaces instead of `any` when calling `window.api`.
- Whenever you extend the Orbit schema (`schema.tsx`), add or update the corresponding model files and consider whether Redux or utility helpers depend on the changed attributes.

## Testing

- Renderer unit tests live in `__tests__/` beside this file and run under Vitest/Jest (see existing `*.test.tsx`). When adding tests that touch Orbit or contexts, use the helpers in `__tests__/` to create memory stores and mock providers.

## Working Guidelines

- Prefer extending existing hooks (`crud/`, `context/`) to keep side-effect logic centralized.
- When adding a new provider or top-level dependency, update `main.tsx` (for initial state) and `App.tsx` (for provider wiring) intentionally; both files gate renderer boot.
- Respect platform differences: guard Electron-only calls with `isElectron`, and keep preload IPC usage inside helpers that degrade gracefully on the web.
