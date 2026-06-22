# Localization

Single source of truth for AI assistants (Claude Code, Cursor) on how to add and
consume localization strings in this repo. Edit **this file only** — `CLAUDE.md`
and `.cursor/rules/localization-takeaways.mdc` both point here.

## Source of truth for new strings

Edit [localization/TranscriberAdmin-en-1.2.xliff](localization/TranscriberAdmin-en-1.2.xliff).
Add or update `<trans-unit>` entries in the correct `<group>` for the feature.
IDs follow `section.key` (e.g. `burrito.format`, `burrito.convertToMp3`). Keep
entries **alphabetically by id** within each group so diffs stay predictable.

For new English units use `<source>…</source>` with an empty `<target/>`, and add
a `<context-group context-type="sourcefile">` pointing to the primary consuming
file (e.g. `BurritoFormat.tsx`) so translators see where the string is used.

## Regenerating TypeScript after XLIFF changes

From the **repo root** in **PowerShell**:

```powershell
cd .\localization\bin\Debug ; &.\.\updateLocalization.exe
```

The exe resolves inputs relative to that folder (see
[localization/Program.cs](localization/Program.cs)) — running it from the repo
root causes a `FileNotFoundException`. Alternatively, run
[localization/Updatestrings.bat](localization/Updatestrings.bat) from `localization\` in cmd.

## What the pipeline writes

The exe generates `localizeModel.tsx` and `localizationReducer.tsx` under
`localization\`, then
[localization/UpdateLocalizationFollowUp.bat](localization/UpdateLocalizationFollowUp.bat)
(spawned when present) copies them to:

- [src/renderer/src/store/localization/model.tsx](src/renderer/src/store/localization/model.tsx)
- [src/renderer/src/store/localization/reducers.tsx](src/renderer/src/store/localization/reducers.tsx)

It also refreshes `strings*.json` / `exported-strings-name.json` under
`src/renderer/public/localization` and `src/renderer/src/store/localization`.

**Do not hand-edit `model.tsx` or `reducers.tsx` for strings that belong in
XLIFF** — the next tool run will overwrite those edits.

## Using strings in components

Use `useSelector` with a selector from
[src/renderer/src/selector/selectors.tsx](src/renderer/src/selector/selectors.tsx)
(e.g. `burritoSelector` with `layout: 'burrito'`), then read properties on the
returned `LocalizedStrings` object. Use `getString` / format helpers where
already established.

**Read strings at the point of use, in the component that renders them** — call
`useSelector(xSelector, shallowEqual)` in that component. See the runtime
language-switch rules below for why this matters.

## Runtime language switching (re-render correctly) — IMPORTANT

The UI must update immediately when the user changes language, with **no
refresh**. This was the TT-6225 fix. Several patterns are now mandatory; do not
revert them.

### Read strings via `useSelector` in the consuming component — never snapshot them into context

Do **not** read string objects in a context provider, store them in `useState`
initial state, and pass them down through context. `useState(initState)`
captures the strings at mount and never updates them, so they go stale when the
language changes.

- Consumers now read their own strings: `const t = useSelector(cardsSelector, shallowEqual)`.
- A provider may still read a string layout it needs **internally** (e.g.
  `sharedStrings` for `useFlatAdd`), but it must not expose strings on context
  state for components to consume.
- Do not add string-typed fields back to any context `initState`.

### Read the current language from Redux, not global state

```ts
const lang = useSelector((state: IState) => state.strings.lang);
```

The locale change flow in [ProfileDialog.tsx](src/renderer/src/components/ProfileDialog.tsx)
updates the Redux `strings` slice, which is the single source of truth.

## Adding a new string section (new `layout` bucket)

If no existing selector fits, add a new entry in `selectors.tsx` that calls
`localStrings(state, { layout: 'yourSection' })`, matching the section name the
tool emits in `model.tsx`. Add the corresponding groups and units in XLIFF, then
run the updater.

## Verification

After regenerating, run from `src\renderer`:

```powershell
npm run typecheck
```

Or from repo root: `npm run typecheck:web`.

## Quick reference

| Step | Action                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Add/update `<trans-unit>` in `localization/TranscriberAdmin-en-1.2.xliff`                                                                  |
| 2    | `cd .\localization\bin\Debug ; &.\.\updateLocalization.exe` (PowerShell from repo root) — or `Updatestrings.bat` from `localization` (cmd) |
| 3    | Confirm `model.tsx` / `reducers.tsx` (and JSON files) updated under `src/renderer/…`                                                       |
| 4    | `cd src\renderer` → `npm run typecheck`                                                                                                    |
| 5    | Use `useSelector(yourSelector)` — add a selector only if the section is new                                                                |
