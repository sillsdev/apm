/**
 * Phrase Back Translate - KNOWN DEFECT repros. Expected to fail until fixed.
 *
 * Every test here states the behaviour the user should get; the comment above
 * it explains what happens today and why. They are kept in their own spec so a
 * green run of the other PBT specs still means something.
 *
 * Each is tagged `@known-defect`, which `npm run cy:run-ct` excludes so CI
 * stays meaningful. Run them with `npm run cy:run-ct-known-defects`, or
 * everything with `npm run cy:run-ct-all`. **When you fix one, drop its tag** -
 * a fixed test that stays tagged is a test nobody runs.
 *
 * The harness (fake microphone, fake server, real everything else) lives in
 * cypress/support/pbtHarness.tsx. Split across several spec files on purpose:
 * a CT spec shares one document for all its tests, and a long run of
 * record/decode cycles in one document degrades audio decoding.
 */
import {
  mountPbt,
  waitForPbtReady,
  postedTakes,
  waitForUploads,
  segmentColors,
  expectSegmentCount,
  recordTake,
  expectRecordEnabled,
  expectRecordDisabled,
  expectNoTakePresent,
  sampleDom,
  pbtCleanup,
  PBT,
  SEGMENTS_3,
  unitLabel,
  sourcePlay,
  startRecordingPass,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

afterEach(() => pbtCleanup());

/**
 * ---------------------------------------------------------------------------
 * KNOWN DEFECTS — expected to fail until fixed.
 * Each test states the behaviour the user should get; the comment explains what
 * happens today and why.
 * ---------------------------------------------------------------------------
 */
describe('PBT known defects', () => {
  it(
    'DEFECT: pausing the reference playback leaves Record disabled forever',
    { tags: '@known-defect' },
    () => {
      // handleRegionPlayEnd is the only path out of phase 'playing', so a user
      // pause strands the step: Record needs currentClausePlayed + recordReady,
      // and nothing sets them until the segment plays all the way through.
      mountPbt({ segments: SEGMENTS });
      waitForPbtReady();
      cy.get(PBT.start).click();
      expectRecordDisabled();
      cy.wait(500);
      sourcePlay().click(); // pause
      expectRecordEnabled();
    }
  );

  it('stays usable when a segment is left while its take is loading', () => {
    // MediaRecord keeps `loading` true until (blobReady && originalBlob), and
    // the mediaId->undefined effect calls reset(), which clears originalBlob -
    // so the condition could never be met again and `loading` stuck. The record
    // button is disabled by `Boolean(loading)`, so the recorder was dead on this
    // segment and every later one until the step was remounted, which matches
    // the hung-PBT report. An abandoned load now clears the flag.
    mountPbt({ segments: SEGMENTS, fileurlDelayMs: 5000 });
    waitForPbtReady();
    startRecordingPass();
    recordTake();
    waitForUploads(1);
    cy.wait(1500); // the take is in rowData; the recorder is loading it
    cy.get(PBT.nextUnit).click({ force: true });

    unitLabel('0:03', '0:06').should('be.visible');
    cy.contains('Loading...').should('not.exist');
    expectRecordEnabled();
  });

  it(
    'DEFECT: clearing a take mid-upload brings the take back',
    { tags: '@known-defect' },
    () => {
      // handleClearRecording resets the recorder, but the in-flight upload still
      // completes and afterUploadCb forces phase back to 'recorded' (and marks
      // the segment optimistically complete). The take the user deleted returns,
      // Record stays disabled, and the audio is on the server.
      mountPbt({ segments: SEGMENTS, putDelayMs: 4000 });
      waitForPbtReady();
      startRecordingPass();
      recordTake();
      waitForUploads(1); // POST done, audio PUT still open
      cy.get('[aria-label="Clear Recording"]').click({ force: true });

      cy.wait(6000); // upload settles
      expectNoTakePresent();
      expectRecordEnabled();
    }
  );

  it(
    'DEFECT: Fewer Segments can produce MORE segments',
    { tags: '@known-defect' },
    () => {
      // TT-7543. resegmentWithParams returns false and applyResegmentResult drops
      // it, so the user gets no feedback and no change — they tap again and again.
      mountPbt({ segments: SEGMENTS });
      waitForPbtReady();
      expectSegmentCount(3);
      cy.get(PBT.fewer).click();
      cy.wait(1500);
      segmentColors().then((after) => {
        expect(
          after.length,
          'Fewer Segments must not increase the count'
        ).to.be.at.most(3);
      });
    }
  );
});

/**
 * INTERMITTENT. The gap below opens only when the take's decode is slow enough
 * that React commits phase 'recorded' before savingRecording is set, so this
 * test can pass on a fast machine and fail under load. It is here rather than in
 * the passing suite because a pass does not mean the gap is closed.
 */
describe('PBT known defects (intermittent)', () => {
  it(
    'DEFECT: navigation is offered while the take is still unsaved',
    { tags: '@known-defect' },
    () => {
      // Consequence, observed twice: a take recorded on segment 1 was uploaded
      // with segment 2's source-segments, so the audio was filed under the wrong
      // segment. Navigation is locked only while phase === 'recording' or
      // savingRecording (CarefulSpeechControls.tsx:198), and savingRecording is
      // not set until the rising edge of canSave
      // (PassageDetailGuidedPhraseRecord.tsx:627) - which waits for the decode.
      // In the gap the arrows are live while nothing is stored, and MediaRecord
      // builds the upload from whatever sourceSegments prop is current then.
      mountPbt({ segments: SEGMENTS });
      waitForPbtReady();
      startRecordingPass();
      expectRecordEnabled();
      cy.get(PBT.recordButton).click();
      cy.get(`${PBT.dockedRecord} svg[data-testid="StopIcon"]`, {
        timeout: 15000,
      }).should('exist');
      cy.wait(4000); // a realistic take: longer take, longer decode, wider gap
      cy.get(PBT.recordButton).click(); // stop

      sampleDom(
        (doc) => {
          const next = doc.querySelector(
            PBT.nextUnit
          ) as HTMLButtonElement | null;
          return {
            offered: Boolean(next) && !next?.disabled,
            stored: postedTakes().length > 0,
          };
        },
        { forMs: 8000, stopWhen: (s) => s.stored }
      ).then((samples) => {
        const unguarded = samples.filter((s) => s.offered && !s.stored);
        expect(
          unguarded.length,
          'navigation stayed locked until the take was stored'
        ).to.equal(0);
      });
    }
  );
});
