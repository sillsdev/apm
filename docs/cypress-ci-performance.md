# Cypress CI performance

How the component test suite was cut from ~27 minutes per pull request to ~3,
what was actually slow, and what to do when it drifts.

Measured 2026-09-01 against `develop` at 9f0c318, Cypress 15.21.0, Chrome 152
headless, 46 spec files / 537 tests.

---

## Results

| Event                     | Before                | After       |
| ------------------------- | --------------------- | ----------- |
| Pull request              | 2 × 13:39 ≈ **27:18** | ≈ **3:00**  |
| Merge to `develop`/`main` | 2 × 13:39 ≈ **27:18** | ≈ **13:39** |

Pull requests run a 10-spec `@smoke` subset (measured **2:36**). Merges and
manual runs still run everything, so nothing lands without full coverage.

Merges improve purely by removing a duplicated run — no coverage was traded.

---

## What was actually slow

### 1. CI ran the whole suite twice

`.github/workflows/dev.yml` had two consecutive steps:

```yaml
- name: Warm up Vite for Cypress tests
  run: npm run cy:run-ct-fast || true # <- this was the ENTIRE suite
- name: Run Cypress tests
  run: npm run cy:run-ct
```

`cy:run-ct-fast` was `npm run cy:run-ct -- --config video=false screenshot=false`.
The `|| true` hid it. The warm-up was serving a real purpose (see §4) — it just
cost a second full suite to do it.

### 2. Cypress's reported total hides half the runtime

- Cypress reported **06:39** for 537 tests.
- Wall clock was **13:39**.

The missing **~7:00** is fixed per-spec overhead — browser launch and bundle
load, roughly **9 seconds per spec** across 46 specs. It never appears in the
duration column, which is why spec _count_ matters as much as test count, and
why the subset is selected with `--spec` rather than filtered in-browser.

> When measuring, trust wall clock, not Cypress's summary. Add the elapsed time
> to your PowerShell prompt:
>
> ```powershell
> function prompt {
>   $t = Get-Date -Format 'HH:mm:ss'
>   $last = Get-History -Count 1
>   $dur = ''
>   if ($last -and $last.EndExecutionTime) {
>     $dur = ' +' + ($last.EndExecutionTime - $last.StartExecutionTime).ToString('mm\:ss')
>   }
>   Write-Host "[$t$dur]" -NoNewline -ForegroundColor DarkGray
>   "  $($executionContext.SessionState.Path.CurrentLocation)$('>' * ($nestedPromptLevel + 1)) "
> }
> ```

### 3. Five specs are 75% of all test time

| Spec                                                | Time     | Tests  |
| --------------------------------------------------- | -------- | ------ |
| `PassageDetailPhraseBackTranslate.edit.cy.tsx`      | 1:37     | 16     |
| `PassageDetailPhraseBackTranslate.cy.tsx`           | 1:32     | 15     |
| `PassageDetailPhraseBackTranslate.selection.cy.tsx` | 1:15     | 8      |
| `PassageDetailPhraseBackTranslate.playback.cy.tsx`  | 0:26     | 4      |
| `PassageDetailPhraseBackTranslate.defects.cy.tsx`   | 0:11     | 5      |
| **PBT subtotal**                                    | **5:01** | **48** |
| All other 41 specs                                  | 1:38     | 489    |

**48 tests take five minutes; the other 489 take 98 seconds.** Individual
offenders: "records backwards, each take against its own region" 16.0s, "marks
the step complete once every segment is recorded" 18.3s, three tests in
`.selection` at 18–20s each.

This is real-time audio playback, not sleeps. See [Open items](#open-items).

### 4. 138 of 161 Vite dependencies were discovered lazily

`optimizeDeps.include` in `cypress/config/local.config.ts` declared **23** deps.
The dep cache from a full run (`node_modules/.vite-ct/deps/_metadata.json`)
showed Vite actually optimized **161**.

Every dep Vite has to discover mid-run triggers a re-optimize and an AUT reload.
That reload leaves **two copies of React** in the page, so the spec that
triggers it fails with:

```
Cannot read properties of null (reading 'useMemo')
```

This is why the whole-suite warm-up existed: it forced discovery of all 161
before the graded run. The fix is to declare them instead of discovering them —
see [ct-optimize-deps.json](#generated-files).

---

## Why a curated subset, and not affected-test selection

The better answer to "what should run per commit" is usually: map changed files
to affected specs. That does not work here.

Building the import graph over `src/renderer/src` (1,070 app files):

- **36 of 46 specs each transitively import 620–720 files.**
- The cause is three barrel files, each with a 621-file transitive closure and
  reachable from each other:

| Barrel                 | Imported by |
| ---------------------- | ----------- |
| `src/crud/index.ts`    | 253 files   |
| `src/utils/index.ts`   | 193 files   |
| `src/control/index.ts` | 128 files   |

Any component importing `from '../crud'` depends on 621 files. So almost any
commit "affects" almost every spec, and selection degrades to running
everything.

Breaking those barrels would make genuine affected-test selection possible and
is worth doing on its own merits — but it is a much larger change than a
curated subset.

---

## How it works now

### Per-commit smoke subset

10 specs / 195 tests, chosen by crossing feature area against six-month churn in
`git log`, so the picks track where regressions actually land.

| Spec                                       | Tests | Covers churn in                        |
| ------------------------------------------ | ----- | -------------------------------------- |
| `Sheet/PassageCard.cy.tsx`                 | 42    | ScriptureTable (33), PlanSheet (17)    |
| `routes/SwitchTeams.cy.tsx`                | 40    | SwitchTeams (15), team/routing         |
| `App/OrgHead.cy.tsx`                       | 30    | app chrome; 8 co-changes               |
| `PassageDetail/mobile/MobileWorkflowSteps` | 26    | highest co-change spec (12)            |
| `Sheet/PlanView.cy.tsx`                    | 25    | plan screen                            |
| `control/RecordButton.cy.tsx`              | 10    | MediaRecord (33)                       |
| `PlayButton.cy.tsx`                        | 9     | WSAudioPlayer (56), useWaveSurfer (24) |
| `PBT.cy.tsx` (2 of 5 describes)            | 6     | PassageDetailContext (21)              |
| `StepEditor/StepEditor.cy.tsx`             | 5     | workflow steps                         |
| `burrito/BurritoWrapper.cy.tsx`            | 3     | burrito entry point                    |

Only the two non-recording describes in `PBT.cy.tsx` are tagged. Those are 10.8s
of that spec's 92s; the three recording-heavy describes still run in the full
suite.

### Tagging a spec into the smoke set

Add the tag to a top-level `describe` (it cascades to nested tests), then
regenerate the spec list:

```ts
describe('MyComponent', { tags: '@smoke' }, () => {
```

```powershell
cd src\renderer
npm run cy:smoke-specs:write
```

### Why `--spec` and not just `grepTags`

`@cypress/grep` has a `grepFilterSpecs` flag that should skip whole spec files
containing no matching test. **It does not work in Cypress 15 component mode** —
the runner resolves the spec list before `setupNodeEvents` runs, so the filtered
`specPattern` the plugin returns is discarded. Verified by calling the plugin
directly: it computes the correct 10 files, and Cypress ignores them.

Since every loaded spec costs ~9s whether or not its tests run, the file list
has to be narrowed on the command line. `grepTags=@smoke` is still passed — it
does the filtering _within_ each listed file, which is what keeps `PBT.cy.tsx`
down to 6 tests.

The plugin stays registered in `local.config.ts` because it does work for
`--e2e`.

---

## Commands

Run from `src/renderer`:

| Command                        | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `npm run cy:run-ct-smoke`      | 10-spec smoke subset (~2:36)                                |
| `npm run cy:run-ct`            | Full suite, minus `@known-defect` (~13:39)                  |
| `npm run cy:run-ct-all`        | Full suite including `@known-defect`                        |
| `npm run cy:smoke-specs`       | Check `--spec` list matches `@smoke` tags (exit 1 if stale) |
| `npm run cy:smoke-specs:write` | Regenerate the `--spec` list                                |
| `npm run cy:ct-deps`           | Check the Vite dep list is complete                         |
| `npm run cy:ct-deps:write`     | Regenerate it from the last full run's cache                |

---

## Generated files

Both are derived artifacts with a check mode suitable for CI or a pre-commit
hook. Neither should be hand-edited.

### `src/renderer/cypress/config/ct-optimize-deps.json`

The 161 dependencies Vite must pre-bundle. Generated by
`env-config/ctOptimizeDeps.cjs` from `node_modules/.vite-ct/deps/_metadata.json`.

**Regenerate after a FULL run**, not a smoke run — a smoke run only exercises 10
specs and would shrink the list, reintroducing the reload failure.

The check reports missing and extra deps separately. Only _missing_ is a
failure; extras are expected if the cache came from a partial run.

### The `--spec` list in `cy:run-ct-smoke`

Generated by `env-config/smokeSpecs.cjs` from the `@smoke` tags, using
`find-test-names` — the same parser `@cypress/grep` uses, so the script and the
runner can never disagree about which files carry the tag.

CI runs the check before the tests, so tagging a spec without regenerating fails
the build instead of silently never running the new spec.

Both scripts refuse to write an empty list. An empty `--spec` makes Cypress run
_everything_, which would turn a "fast" smoke job into the full suite without
anyone noticing.

---

## Open items

### Mock the clock in the PBT specs

**The biggest remaining win.** Five minutes of a 6:39 suite is spent waiting for
audio to play in real time. Mocking the clock or the audio element in the PBT
harness would cut the full suite to roughly two minutes — with no coverage
traded, and it helps every merge build, not just pull requests.

### 41 seconds of hard-coded `cy.wait(<ms>)`

95 calls, concentrated in `PBT.defects` (13.5s), `.playback` (6.6s), `.edit`
(4.5s) and `PlanBar` (3.6s). Converting to assertion-based waits is pure
speedup.

### Does the CI job need the Docker container?

The `cypress-tests` job builds a Docker image, starts a container on port 3000,
and waits for it — but only runs **component** tests, which mount components
directly. Searching the component-test paths found nothing needing that origin:

- The only `cy.visit` is in `loginByAuth0`, an **e2e** command.
- `VITE_CALLBACK: 'http://localhost:3000/callback'` in `cypress/support/component.tsx`
  is a config string, never fetched.
- The localization fetch in `store/localization/actions.tsx` is
  `appPath() + '/localization/...'`, and `appPath()` returns `''` on web — so it
  resolves against the AUT's own origin (Cypress's dev server serving `public/`),
  not port 3000.

Component tests were reported failing without the container in the past. That
predates the `optimizeDeps` fix, and the reload failure in §4 is a strong
candidate for what was actually breaking. **Not yet removed** — worth confirming
a local full run passes with nothing on port 3000 before touching it.

### Break the `crud` / `utils` / `control` barrels

Would enable real affected-test selection and cut cold-start bundling.

---

## Verifying the dependency fix

The `optimizeDeps` change has not been exercised end to end. To confirm:

```powershell
cd src\renderer
Remove-Item -Recurse -Force node_modules\.vite-ct
npm run cy:run-ct-smoke
```

Expect a slower first spec (161 deps bundled up front) and **no**
`optimized dependencies changed, reloading` in the output. If that message
appears, regenerate the list from a full run rather than reinstating a warm-up
step.
