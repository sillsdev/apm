## Jest Smoke Testing

Analysis
I measured the suite three ways and picked the set on data rather than intuition. No files changed — this is the proposal.**

## **The numbers first**

**All measured locally, `--maxWorkers=1 --no-cache` to match what CI actually runs (`test:ci`):**

|             Run              | Suites | Tests |   Time   |
| :--------------------------: | :----: | :---: | :------: |
| Full suite (today's CI step) |  213   | 1,673 | **7:56** |
|      Proposed smoke set      |   25   |  209  | **1:26** |

**So ~6.5 minutes back on every PR. For reference, the same full suite is 2:17 serially with a warm ts-jest cache and 2:58 in parallel — the `--no-cache` flag is most of CI's cost, but a fresh runner has no cache to reuse anyway, so 7:56 is the honest number.**

## **How I picked**

**Same method as [cypress-ci-performance.md](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/docs/cypress-ci-performance.md): feature area crossed with six-month churn. I built a test→source import map (213 suites, resolving relative, `moduleDirectories: \['node\_modules','src'\]`, and the `@model`/`burrito` mappers), weighted each source file by its commit count since March, then ran a cost-aware greedy set-cover using per-suite durations from a full instrumented run.**

**Result: 25 of 213 suites (12%) reach 63% of the churn-weighted surface the entire suite reaches — 117 of the 290 changed source files any jest test touches.**

**_The cost weighting mattered. Twelve suites are half the serial runtime, and they're the ones to keep out_: `PassageDetailMarkVerses.test.tsx` (131s/19 tests), `FaithbridgeIframe` (88s), `useBurritoAudio` (85s), `PassageDetailCarefulSpeech` (85s), `useTranscribeActions` (71s), `getSheet` (57s), `ProfileDialog` (52s for 3 tests). Each has a cheaper suite covering the same area.**

## **The set**

|                                                                                                                   Suite                                                                                                                    | Tests |                             Top churn it guards                              |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :---: | :--------------------------------------------------------------------------: |
|                                                                                                          **Passage detail shell**                                                                                                          |       |                                                                              |
|                                           [routes/PassageDetail.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/routes/PassageDetail.test.tsx)                                            |  17   |    PassageDetail (25), PassageDetailContext (22), PassageDetailGrids (20)    |
|                         [PassageDetail/PassageDetailRecord.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailRecord.test.tsx)                         |  10   |          MediaRecord (37), PassageDetailRecord (22), Uploader (13)           |
|                   [PassageDetail/PassageDetailStepComplete.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailStepComplete.test.tsx)                   |   4   |            PassageDetailStepComplete (9), usePassageNavigate (3)             |
|                   [PassageDetail/PassageDetailMobileDetail.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailMobileDetail.test.tsx)                   |   3   |           MobileWorkflowSteps (15), PassageDetailMobileFooter (13)           |
|                                                                                                         **BOLD / careful speech**                                                                                                          |       |                                                                              |
| [PassageDetailGuidedPhraseRecord.nextDuringPlayback.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailGuidedPhraseRecord.nextDuringPlayback.test.tsx) |   2   | GuidedPhraseRecord (23), useWavesurferRegions (17), PassageDetailPlayer (17) |
|              [carefulSpeech/useGuidedPhraseSegments.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/carefulSpeech/useGuidedPhraseSegments.test.tsx)              |   2   |                              WSAudioPlayer (57)                              |
|               [carefulSpeech/carefulSpeechCompletion.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/carefulSpeech/carefulSpeechCompletion.test.ts)               |   9   |                         carefulSpeechCompletion (6)                          |
|                                                                                                      **Transcription / translation**                                                                                                       |       |                                                                              |
|            [lwcTranscription/LwcTranscriptionEditor.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/lwcTranscription/LwcTranscriptionEditor.test.tsx)            |   6   |  BoldClauseTranscriptionEditor (6), AsrProgress (6), useGetAsrSettings (4)   |
|                 [PassageDetail/PassageDetailLwcTranslation.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailLwcTranslation.test.tsx)                 |  13   |                          LwcTranslationControls (9)                          |
|                     [PassageDetail/PassageDetailTranscribe.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/PassageDetailTranscribe.test.tsx)                     |   2   |                Transcriber (17), PassageDetailTranscribe (10)                |
|                             [PassageDetail/ConsultantCheck.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/PassageDetail/ConsultantCheck.test.tsx)                             |  16   |                      MediaPlayer (5), GlobalContext (4)                      |
|                                                                                                           **Recording & audio**                                                                                                            |       |                                                                              |
|                                             [crud/useWavRecorder.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/crud/useWavRecorder.test.ts)                                              |   5   |                   AudioMediaRecorder (6), WavRecorder (6)                    |
|                                         [components/MediaRecord.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/MediaRecord.test.tsx)                                          |  13   |                     WSAudioPlayer (57), MediaRecord (37)                     |
|                                                                                                          **Upload / sync queue**                                                                                                           |       |                                                                              |
|                                 [store/upload/actions.uploadBusy.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/store/upload/actions.uploadBusy.test.ts)                                  |   2   |                     upload/actions (16), uploadRetry (5)                     |
|                                [store/upload/pendingMediaUploads.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/store/upload/pendingMediaUploads.test.ts)                                 |  15   |                           pendingMediaUploads (8)                            |
|                                             [crud/useMediaUpload.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/crud/useMediaUpload.test.ts)                                              |  12   |                    useMediaUpload (13), TokenProvider (8)                    |
|                                                                                                              **Sheet / plan**                                                                                                              |       |                                                                              |
|                   [Sheet/findPlanSheetRowFromReferenceQuery.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/Sheet/findPlanSheetRowFromReferenceQuery.test.ts)                   |  23   |                       publishing M/S reference lookup                        |
|                                       [\_\_tests\_\_/workflowSheet.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/__tests__/workflowSheet.test.ts)                                        |   4   |                         section/passage sheet shape                          |
|                                                                                                          **Teams & permissions**                                                                                                           |       |                                                                              |
|                              [crud/canonicalPersonalWorkflow.adr.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/crud/canonicalPersonalWorkflow.adr.test.ts)                               |  15   |                     ADR 0012 Personal vs Work Alone Team                     |
|                                         [utils/useStepPermission.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/utils/useStepPermission.test.ts)                                          |  15   |                          step permission resolution                          |
|                                                                                                       **Import / export / burrito**                                                                                                        |       |                                                                              |
|                                  [store/importexport/copyProject.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/store/importexport/copyProject.test.ts)                                   |   3   |                importexport/actions (13), electronExport (4)                 |
|                                     [burrito/data/burritoBuilder.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/burrito/data/burritoBuilder.test.ts)                                      |  11   |                          burrito metadata assembly                           |
|                                                                                                                **Paratext**                                                                                                                |       |                                                                              |
|                                [business/localParatext/localSync.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/business/localParatext/localSync.test.ts)                                 |   4   |                        localSync, cross-chapter refs                         |
|                                                                                                              **Localization**                                                                                                              |       |                                                                              |
|                                               [selector/localize.test.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/selector/localize.test.ts)                                                |   2   |                   the TT-6225 `shallowEqual`/`lang` guard                    |
|                                                                                                                **Graphics**                                                                                                                |       |                                                                              |
|                               [GraphicPicker.openFetchRace.test.tsx](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/src/components/GraphicPicker.openFetchRace.test.tsx)                               |   1   |                              GraphicPicker (11)                              |

**_Two deliberate choices: `selector/localize.test.ts` is 2 tests but it's the regression guard for the language-switch rule CLAUDE.md calls mandatory, and it costs 2.4s. And the set leans toward logic Cypress CT doesn't_ cover — upload queue, import/export, Paratext sync, ADR 0012 team resolution — since PlanView, PassageCard, SwitchTeams, OrgHead, StepEditor and RecordButton are already in the Cypress smoke ten.**

## **Running it**

```
**`cd src\\renderer`**

**`npx jest --maxWorkers=1 --runTestsByPath (Get-Content ..\\..\\jest-smoke.txt)`**
```

**For the wiring I'd mirror Cypress rather than invent something: a `jest.smoke.config.ts` that spreads the base config and overrides `testMatch` with the explicit list, plus `test:smoke` in [src/renderer/package.json](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/package.json), and the CI step switched to smoke on `pull\_request` / full on push — same shape as the Cypress steps in [dev.yml:157-166](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/.github/workflows/dev.yml#L157-L166). Unlike Cypress, jest needs no tag-plus-generator dance: `--testPathPatterns` genuinely skips unlisted files, so the list can live in one reviewable config file with no sync script.**

## **Two things I noticed while measuring**

- **`collectCoverageFrom: \['src/\*\*/\*.ts', ...\]` in [jest.config.ts:9](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/jest.config.ts#L9) never matches `.tsx` — I confirmed with micromatch. `npm run test:coverage` currently reports zero coverage for every component in the app.**

- **`--maxWorkers=1` in `test:ci` costs about 40% on its own here (2:58 parallel vs 7:56). The comment says it's for CI debugging. Dropping it would speed up the full-suite push builds independently of any smoke split.**

**Want me to wire up the config, the npm script, and the CI change?**

## **

Implementation**

**[src/renderer/jest.smoke.config.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/jest.smoke.config.ts) (new) — spreads the base config and overrides `testMatch` with the explicit 25-file list, grouped by feature area with the selection rationale in the header. It throws at config-load time if any listed file no longer exists (verified: a bad entry aborts the run with a message naming it) — that's the equivalent of the `smokeSpecs.cjs` guard, so a rename can't silently shrink the subset.**

**[src/renderer/package.json**](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/package.json)

- **`test:ci` — dropped `--maxWorkers=1`**

- **`test:smoke` / `test:smoke:ci` — new, mirroring the existing local/CI script pairing**

- **`test:coverage` — was `npm run test --watchAll=false --collectCoverageFrom=... --coverage`. npm doesn't forward those flags to jest without `--`, so it was running plain `jest` and producing no coverage at all. Now `jest --coverage`, which picks up the fixed glob.**

**[src/renderer/jest.config.ts](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/src/renderer/jest.config.ts) — `collectCoverageFrom` now `src/\*\*/\*.ts?(x)`, plus exclusions for `\*.test.\*`, `\*.cy.\*` (49 Cypress specs live under `src/`) and `\*.d.ts`, which would otherwise be pulled into the report by the wider glob.**

**[.github/workflows/dev.yml](vscode-webview://1vvl62agp8nmso4u3onasscp49436tio9t463rhlr0pga78gsjbi/.github/workflows/dev.yml#L136-L151) — PR runs `test:smoke:ci`, push/dispatch runs `test:ci`, same `if:` split as the Cypress steps below it.**

## **Verified**

|             Check              |                                                Result                                                |
| :----------------------------: | :--------------------------------------------------------------------------------------------------: |
|    `test:smoke` (25 files)     |                                         209 passed, 0 failed                                         |
| `test:smoke:ci` (`--no-cache`) |                                         209 passed, **1:16**                                         |
|    `test:ci` full, parallel    |                      213 suites / 1,670 passed, 3 skipped, **4:03** (was 7:56)                       |
|       Stale-entry guard        |                                       fires and names the file                                       |
|       Coverage after fix       |                      970 files, **461 `.tsx`** (was 0), no test/cy/d.ts leakage                      |
|         `tsc --noEmit`         |                                                clean                                                 |
|    `eslint` on both configs    |                                                clean                                                 |
|       `prettier --check`       | the 4 failures are pre-existing generated localization files — confirmed identical on a stashed tree |

**So the PR path goes ~8:00 → ~1:20, and the push path ~8:00 → ~4:00.**

**Two honest caveats:**

- **My machine has more cores than a GitHub `ubuntu-latest` runner (2 vCPU), so the parallel gain on `test:ci` will be smaller there than the 476s→243s I measured. The smoke saving doesn't depend on core count and will hold.**

- **Removing `--maxWorkers=1` surfaces `A worker process has failed to exit gracefully` in the log. Exit code is still 0 and all 213 suites pass; it's a pre-existing teardown leak that in-band mode was hiding. Worth a `--detectOpenHandles` pass sometime, but it isn't blocking.**

**The work sits uncommitted on a `jest-smoke` branch (which appeared during the session — I didn't create it; the session started on `develop`). Want me to commit it, and add a `docs/jest-ci-performance.md` alongside the Cypress one?**
