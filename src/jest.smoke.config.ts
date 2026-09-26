import { existsSync } from 'fs';
import { resolve } from 'path';

import type { JestConfigWithTsJest } from 'ts-jest';

import { config as base } from './jest.config';

// Per-pull-request smoke subset of the jest suite.
//
// The full suite is 213 files / 1,673 tests and takes ~8 minutes in CI
// (`--no-cache` on a cold runner is most of that). This subset is 25 files /
// 209 tests and takes ~1.5 minutes, while still reaching 63% of the
// churn-weighted source surface the whole suite reaches — 117 of the 290
// changed files any jest test touches.
//
// Selection method is the one documented for the Cypress subset in
// docs/cypress-ci-performance.md: feature area crossed with six-month churn in
// `git log`, so the picks track where regressions actually land. Cost matters
// too — twelve suites are half the suite's runtime, and each of them has a
// cheaper suite covering the same area, so none of them are here.
//
// Unlike Cypress component mode, jest really does skip unlisted files, so the
// list can live here rather than being generated into a --spec string.
//
// Rules of thumb when editing this list:
//   - Lean toward logic Cypress CT does not already cover. PlanView,
//     PassageCard, SwitchTeams, OrgHead, StepEditor and RecordButton are in the
//     Cypress @smoke ten; upload queue, import/export, Paratext sync and the
//     ADR 0012 team resolution are only covered here.
//   - Check the cost before adding. `npx jest --silent <file>` — anything over
//     ~10s wants a cheaper suite in the same area instead.
//   - Merges to develop/main still run everything, so leaving something out
//     delays a signal, it does not lose one.
const SMOKE_TESTS = [
  // Passage detail shell
  'src/routes/PassageDetail.test.tsx',
  'src/components/PassageDetail/PassageDetailRecord.test.tsx',
  'src/components/PassageDetail/PassageDetailStepComplete.test.tsx',
  'src/components/PassageDetail/PassageDetailMobileDetail.test.tsx',
  // BOLD / careful speech
  'src/components/PassageDetail/PassageDetailGuidedPhraseRecord.nextDuringPlayback.test.tsx',
  'src/components/PassageDetail/carefulSpeech/useGuidedPhraseSegments.test.tsx',
  'src/components/PassageDetail/carefulSpeech/carefulSpeechCompletion.test.ts',
  // Transcription / translation
  'src/components/PassageDetail/lwcTranscription/LwcTranscriptionEditor.test.tsx',
  'src/components/PassageDetail/PassageDetailLwcTranslation.test.tsx',
  'src/components/PassageDetail/PassageDetailTranscribe.test.tsx',
  'src/components/PassageDetail/ConsultantCheck.test.tsx',
  // Recording & audio
  'src/crud/useWavRecorder.test.ts',
  'src/components/MediaRecord.test.tsx',
  // Upload / sync queue
  'src/store/upload/actions.uploadBusy.test.ts',
  'src/store/upload/pendingMediaUploads.test.ts',
  'src/crud/useMediaUpload.test.ts',
  // Sheet / plan
  'src/components/Sheet/findPlanSheetRowFromReferenceQuery.test.ts',
  'src/__tests__/workflowSheet.test.ts',
  // Teams & permissions
  'src/crud/canonicalPersonalWorkflow.adr.test.ts',
  'src/utils/useStepPermission.test.ts',
  // Import / export / burrito
  'src/store/importexport/copyProject.test.ts',
  'src/burrito/data/burritoBuilder.test.ts',
  // Paratext
  'src/business/localParatext/localSync.test.ts',
  // Localization — the TT-6225 runtime language-switch guard
  'src/selector/localize.test.ts',
  // Graphics
  'src/components/GraphicPicker.openFetchRace.test.tsx',
];

// A renamed or deleted test would otherwise just drop out of the subset and
// nobody would notice the smoke job got cheaper. Fail loudly instead.
const missing = SMOKE_TESTS.filter((t) => !existsSync(resolve(__dirname, t)));
if (missing.length > 0) {
  throw new Error(
    `jest.smoke.config.ts lists ${missing.length} test file(s) that no longer exist:\n` +
      missing.map((m) => `  ${m}`).join('\n') +
      `\nUpdate the list — pick a replacement covering the same area, don't just delete the line.`
  );
}

const config: JestConfigWithTsJest = {
  ...base,
  testMatch: SMOKE_TESTS.map((t) => `<rootDir>/${t}`),
};

export default config;
