# Coding Standards

Judgement-call rules for reviewing changes to `web/`. The reviewer applies
every rule to every hunk in the diff and cites the rule's heading for each
finding.

Tooling already enforces formatting (Prettier), `consistent-type-imports`,
`no-only-tests`, and `strict` TypeScript. Run `npm run lint` and
`npm run typecheck` from `web/` rather than re-checking those by eye.

## Effects

Source: <https://react.dev/learn/you-might-not-need-an-effect>. An effect
exists only to **sync with an external system**: wavesurfer, the DOM, timers,
Orbit/IndexedDB, Electron IPC, a network subscription. Every other effect is a
finding.

- **Derived values** come from render, or from `useMemo` when the work is
  expensive. Examples: filtered lists, flags such as admin or offline, labels.
  The finding is state set from an effect that only copies or reshapes props,
  Redux values, or other state.
- **Event-driven logic** runs in the handler that caused it. This covers
  navigation, notifying a parent (`onChange`, `onToolChanged`), and work after
  a mutation such as selecting what was just pasted.
- **Effect chains**, where one effect sets state that triggers the next,
  collapse into one computation or one handler.
- **Resetting state when a prop changes** uses a `key` on the child, not an
  effect that watches the prop.
- **Cleanup** comes with every subscription, listener, and timer an effect
  starts.
- **Navigation** happens in the handler. The finding is a target path stored
  in state and navigated to during render.

## Localized strings

[docs/ai/localization.md](docs/ai/localization.md) is the source of truth.
Read it. The rule a reviewer most often has to catch: localized strings, and
JSX built from them, are read with `useSelector` in the component that renders
them. They are never kept in `useState`, a ref, or context state, because a
snapshot there goes stale when the language changes.

## State

- **Local first.** State lives in the lowest component that needs it, and is
  lifted only when a sibling needs it too.
- **Single source of truth.** Persisted records come from Orbit (memory source
  and its hooks), and app-wide UI state comes from Redux. A component keeps a
  copy in `useState` only to edit a draft, and the copy is named for that, for
  example `draftTitle`.
- **Contexts stay small.** A provider exposes values its consumers actually
  read. A value nobody reads, or a copy of Orbit or Redux data, is a finding.
- **Related flags become one union.** Two or more booleans that cannot all be
  true together become one `status` union, so that impossible combinations
  cannot be represented.
- **Immutability.** State and Redux slices are updated by creating new objects
  and arrays (spread, `map`, `filter`). The finding is mutating a value in place
  (`push`, `splice`, assigning a property) and then passing it to a setter or
  `dispatch`, which can skip the re-render or leak the change to other readers.
  Orbit memory records are the known exception: Orbit mutates them itself, which
  is why `useOrbitData` rather than reference equality drives re-renders.

## One owner per behaviour

When the diff adds code that does something an existing event handler,
callback, or hook already does, the reviewer flags the **duplicate path**. One
example is calling `setCurrentRegion` next to a `region-created` handler that
already calls it. Two paths drift apart and cause double callbacks. The fix
either routes through the existing owner, or keeps the second path with a
comment explaining why the owner cannot be relied on there.

## Components and hooks

- **Single responsibility.** If a component needs "and" to describe it, split
  it. Move non-trivial logic into a custom hook named for what it does.
- **Pure helpers.** Arithmetic, parsing, and data-shaping logic goes in an
  exported pure function with its own unit test, as in
  `web/src/crud/audioClipboard.ts`.
- **Parameter objects.** A new function or hook signature with more than about
  four positional parameters takes an options object instead. Existing long
  signatures such as `useWaveSurferRegions` are known debt. A diff that adds
  another positional parameter to one of them is a finding.
- **Return values that are used.** A function returns a value only when at
  least one caller reads it.
- **Flat JSX.** A ternary nested inside another ternary becomes an early
  return or a sub-component.
- **`useMemo` and `useCallback` where they earn it.** Use them for expensive
  work, or to keep a value referentially stable when it feeds a dependency
  array or a memoized child.
- **Function components.** New components are function components with hooks.
  Error boundaries are the exception, because React still requires a class for
  them (see `web/src/hoc/ErrorBoundary.tsx`). Type props on the parameter,
  `function X(props: XProps)`, rather than `React.FC<XProps>`.
- **Stable list keys.** A `key` comes from a stable id, not the array index,
  unless the list never reorders, inserts, or deletes. Index keys make React
  reuse the wrong row's state after a change.
- **Dependency-array suppressions explain themselves.** A new
  `// eslint-disable-next-line react-hooks/exhaustive-deps` carries a comment
  naming the dependency left out and why. Leaving out Orbit `memory`, or a
  custom hook's return value that is not referentially stable, is often
  correct here, because including it causes excess re-runs or races. The
  finding is a suppression with no reason, which leaves the next reader unable
  to tell a deliberate omission from a stale-value bug.

## Types

- **Narrow types in new code.** `no-explicit-any` is off in ESLint because of
  legacy code. New code uses real types, or `unknown` narrowed with a type
  guard. An `as` cast or a `!` assertion carries a comment saying why it is
  safe.
- **Derived types.** Build new types with `Pick`, `Omit`, `ReturnType`, or
  `ComponentProps<typeof X>` rather than restating an existing shape. Name a
  shape the second time it appears inline.
- **Validated boundaries.** Data from the server, IndexedDB, `localStorage`,
  URL params, or Electron IPC is checked before code trusts its shape.

## Naming and comments

- **Named constants.** A repeated literal such as a colour, timeout,
  threshold, or id prefix becomes a named constant in the module that owns it.
- **Comments say why.** A comment records the reason, the constraint, or the
  ticket (for example `TT-7666`). Names and types carry the what.
- **Naming conventions.** Components use `PascalCase`, hooks `useX`, internal
  handlers `handleX`, and callback props `onX`. Wavesurfer hook methods keep
  the existing `ws` prefix.

## Tests

- **Behaviour over implementation.** Jest and Cypress component tests check
  what the user sees or what a hook returns. They do not check internal
  state.
- **Pure helpers get unit tests** that cover the boundary cases: empty input,
  zero length, and clamping at each end.
- **Hook tests** may assert on callbacks they pass in, because those callbacks
  are the hook's public contract.
- Test patterns live in the Cursor rules. Read the one for the test type in
  the diff: [jest-testing-takeaways.mdc](.cursor/rules/jest-testing-takeaways.mdc),
  [cypress-component-patterns.mdc](.cursor/rules/cypress-component-patterns.mdc),
  [cypress-testing-takeaways.mdc](.cursor/rules/cypress-testing-takeaways.mdc).

## Errors

- **Reported, not swallowed.** A caught error the user cannot recover from is
  reported with `logError(Severity.error, …)` from
  `web/src/utils/logErrorService.ts`, which forwards to Bugsnag, and the user
  sees a message or a fallback. The finding is a `catch` that drops the error,
  or one that only calls `console.error`.
- **Failed requests have a fallback.** Code that calls the server, Orbit, or
  IPC says what happens when the call fails: retry, an error state, or a
  default value. Input validation at boundaries is covered under Types.
- **No debug logging.** A `console.log` added in the diff is a finding unless
  it is behind a debug flag or carries a comment saying why it stays.

## Async

- **No floating promises.** A promise that is not awaited has a `.catch`, or a
  `void` with a comment saying why a rejection is safe to ignore.
- **`async`/`await` over chains.** New code uses `async`/`await` rather than
  nested `.then` callbacks. A synchronous handler may use a `.then` chain when
  it has to return before the work finishes.
- **Explicit request states.** A component that fetches renders loading and
  error states as well as success, modelled as one `status` union (see State).
- **No stale results.** An async result is applied only if it is still
  current. Guard it with a cancelled flag or `AbortController` set in effect
  cleanup, or a request id compared before `setState`. The finding is a
  `setState` after an `await` with no such guard, where a slower earlier
  request can overwrite a newer one or update an unmounted component.

## Modules

- **File length.** Files stay under about 500 lines. The finding is a diff that
  pushes a file past 500 lines, or adds substantial code to a file already over
  it; suggest what to extract. Touching an existing long file is not on its own
  a finding.

## Electron calls

- **Gated desktop code.** Code that calls `window.api` or anything else
  desktop-only runs behind an `isElectron` check (from `web/api-variable`), so
  the web build never reaches it.
- **Cloneable return values.** IPC handlers (`ipcMain.handle` /
  `ipcRenderer.invoke`) pass their results through Electron's structured
  clone. A handler may return primitives, `null`/`undefined`, plain objects,
  arrays, and typed arrays such as `Uint8Array`. The finding is returning a
  value that holds functions, a class instance, a DOM node, or a native module
  object. Electron rejects these with "An object could not be cloned", and a
  class instance that does clone arrives as a plain object without its
  methods. Map such a value to a plain object in the main process before
  returning it.
- **Typed desktop calls.** Adding an IPC call takes three edits: a handler in
  `electron/main/ipcMethods.ts`, the bridge in `electron/preload/index.ts`, and
  the signature in `MainAPI` (`web/src/model/main-api.ts`). The finding is a
  call that skips one of these, or casts around `MainAPI`. New signatures
  avoid `Promise<unknown>`.

## Orbit

- **Reactive reads use `useOrbitData`.** Orbit memory is mutated in place, so
  data read during render straight from `memory.cache.query` does not
  re-render the component when it changes. Render-time reads use
  `useOrbitData('table')` (`web/src/hoc/useOrbitData.ts`), which subscribes to
  a live query and re-renders when that table changes. One-off reads inside an
  event handler or async action may still query `memory.cache` directly.
- **Cheap subscriptions.** Each `useOrbitData` call opens its own live query
  and returns the whole table. The finding is calling it in a component
  rendered once per row or list item, or filtering or joining its result on
  every render without `useMemo`. Read the table once in a parent or hook and
  pass the derived records down.

## Offline

Two different flags mean "offline". `offline` is an Electron session started
in local mode. `connected` (`useGlobal('connected')`, kept current by
`useCheckOnline`) is false when an online session, web or Electron, has lost
its network.

- **Writes go through Orbit or are gated on `connected`.** A write path either
  goes through `memory.update`, which queues it for sync, or it is a direct
  server call (`axiosPost`, `axiosPatch`, `axiosDelete`, `remote.update`, an
  upload) that is hidden or disabled when `!connected`, and tells the user
  why, for example with the shared `mustBeOnline` string. Third-party and
  server-processed features (AI, ASR, Aquifer, Paratext online sync) are
  allowed to be online-only on these terms.
- The finding is a direct server call on a write path with no guard, or a
  guard that checks only `offline`. Such a call fails with an error when an
  online session drops its network instead of being prevented. A write that
  Orbit could express (a relationship or attribute change) but goes to a
  custom endpoint instead is also a finding.
