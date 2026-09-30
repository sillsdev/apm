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
  clickSegmentUntilSelected,
  waitForSourceStopped,
  expectTakePresent,
  expectRecordNotVisible,
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
  it('offers Record once the user pauses the reference playback', () => {
    // handleRegionPlayEnd used to be the only path out of phase 'playing', so a
    // user pause stranded the step: Record needs currentClausePlayed +
    // recordReady, and nothing set them until the segment played all the way
    // through. The step now takes the reference audio stopping as the signal.
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    cy.get(PBT.start).click();
    expectRecordDisabled();
    cy.wait(500);
    sourcePlay().click(); // pause
    expectRecordEnabled();
  });

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
    cy.get(PBT.next).click({ force: true });

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
 * INTERMITTENT. Each defect here needs a timing window that a fast, idle
 * machine can close on its own, so these tests can go green with nothing
 * fixed. They are kept out of the passing suite because a pass proves nothing
 * here - only a failure is informative.
 */
describe('PBT known defects (intermittent)', () => {
  it(
    'DEFECT: navigation is offered while the take is still unsaved',
    { tags: '@known-defect' },
    () => {
      // The gap opens only when the take's decode is slow enough that React
      // commits phase 'recorded' before savingRecording is set, so this passes
      // on a fast machine and fails under load.
      //
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
          const next = doc.querySelector(PBT.next) as HTMLButtonElement | null;
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

  it(
    'DEFECT: discarding a failed take can re-upload it',
    { tags: '@known-defect' },
    () => {
      // The window is sub-100ms, so whether the click lands inside it depends
      // on machine speed and on what else the spec file has already loaded:
      // the identical body fails every time in
      // PassageDetailPhraseBackTranslate.edit.cy.tsx but has been seen passing
      // here.
      //
      // A rejected upload leaves the take dirty - MediaRecord only clears
      // `filechanged` when there is a mediaId - so `canSave` flips back to true
      // straight after the failure. The step's auto-save effect reads
      // `saveRejectedRef` when it *runs*, not when it is scheduled, and Clear
      // Recording clears that ref. So if the click lands before React has
      // flushed the pending canSave effect, the effect sees canSave true with
      // the guard already down and uploads the take the user just discarded.
      //
      // Two ways that bites. If the server is still failing, afterUploadCb
      // forces phase back to 'recorded', the Upload Failed banner returns, and
      // Record is replaced by Next Segment - the user cannot record a
      // replacement without navigating away and back. If the failure was
      // transient, the re-upload succeeds and the deleted take is silently
      // saved as the back translation for that clause.
      //
      // The window is short: a 100ms pause before the click is enough to close
      // it, which is why the passing copy of this test in
      // PassageDetailPhraseBackTranslate.edit.cy.tsx has one. Cypress clicks a
      // millisecond or two after the banner renders, so this untimed copy
      // reproduces it. A real user is unlikely to be that fast, but the guard
      // holds by effect-flush ordering rather than by state, so a loaded or
      // slow device widens the window. The fix belongs in handleClearRecording:
      // drop the dirty take before clearing saveRejectedRef, so a discarded
      // take can never be re-uploaded whatever the render timing.
      mountPbt({ segments: SEGMENTS, failPostWithStatus: 400 });
      waitForPbtReady();
      startRecordingPass();
      recordTake();
      cy.contains('Upload Failed', { timeout: 25000 }).should('be.visible');

      cy.get('[aria-label="Clear Recording"]').click();
      cy.contains('Upload Failed').should('not.exist');
      expectRecordEnabled();
    }
  );

  it(
    'DEFECT: tapping the last segment stops it a beat after it starts',
    { tags: '@known-defect' },
    () => {
      // TT-7690. Tap a segment during a recording pass and it plays for ~130ms,
      // stops on its own, and Record never enables - the user is stranded on
      // that segment with no way to record it. Reported against the last
      // segment, which is why this fixture pins durationSec to its end, but the
      // cause is not specific to the last one.
      //
      // WHERE IT GOES WRONG. The step's nav effect pauses whatever is playing
      // and immediately plays the tapped clause - setPlay(false) then
      // playCurrentClause(idx) at PassageDetailGuidedPhraseRecord.tsx:1371,
      // about a millisecond apart, both imperative calls straight at the
      // player. The pause is then reported back up through onPlayStatus into
      // setPlayerPlayingBoth (:971), which stores it in `playerPlaying`, which
      // is handed straight back down as `playing={playerPlaying}` (:1916) - so
      // the player's own report returns to it as a command on its `isPlaying`
      // prop. That round trip is a React render, so it commits *after* the
      // setPlay(true) that has already started the new clause, and
      // WSAudioPlayer.tsx:1329 replays the stale `false` over it.
      //
      // A captured failing run, one click, times in ms from the click:
      //     34  nav effect: idx 2, currentIndex 1, isPlaying true
      //     35  pause (nav effect setPlay(false))
      //     35  playCurrentClause 2 -> seek 6.1 -> setPlay(true)
      //    151  playing = true
      //    169  pause, from the isPlaying effect (commitHookEffectListMount)
      //    310  playing = false, Record still disabled
      //
      // INTERMITTENT because it is decided by commit timing alone: if the echo
      // lands before setPlay(true) it is a no-op (handlePlayStatus returns
      // early when play === playingRef.current) and the clause plays through.
      // Failure rate moves with machine load: about two runs in three when this
      // was first found, one in three on a quiet machine since. Run it several
      // times before believing a green.
      //
      // WHAT NEEDS FIXING. The step should not feed the player's reported
      // status back down to it as a command - `playerPlaying` is a mirror of
      // what the player just said, and a mirror is not an instruction.
      // Breaking that loop is the real fix. Suppressing the echo inside
      // WSAudioPlayer instead (ignore an `isPlaying` change that contradicts
      // live state while a report of ours is still in flight) was prototyped
      // and did hold the spec green across three runs, but it needs a time
      // window to decide what "in flight" means, which is a guess, not a
      // guarantee.
      mountPbt({ segments: SEGMENTS, durationSec: 9 });
      waitForPbtReady();
      startRecordingPass();

      clickSegmentUntilSelected(1);
      unitLabel('0:03', '0:06').should('be.visible');

      clickSegmentUntilSelected(2);
      unitLabel('0:06', '0:09').should('be.visible');
      expectRecordDisabled();

      // Give the segment time to play out. Note this wait is weaker than it
      // looks: it is a `should` on `playing === false`, so its first poll also
      // passes when the step has not started playing yet. That is tolerable in
      // a defect repro - expectRecordEnabled below carries its own 20s timeout,
      // so Record still gets its chance either way - but it means a failure
      // here does not by itself prove playback ran. Read it with the write-up
      // above, and do not promote this test to the passing suite on the
      // strength of this wait alone.
      waitForSourceStopped();
      cy.wait(200);
      expectRecordEnabled();
    }
  );

  it(
    'DEFECT: pausing soon after a segment change can leave Record disabled',
    { tags: '@known-defect' },
    () => {
      // Changing segments starts the newly selected one playing. Pause it
      // quickly and Record does not come back on, leaving the user on a segment
      // they cannot record; pause a beat later and it enables as it should.
      // Confirmed by hand in the running app, not only here - the quick/slow
      // split is reproducible, so this is a real user-facing defect rather than
      // a test artifact.
      //
      // CAUSE. The step only counts a clause as heard when the stop is late
      // enough to be a real one: handlePlayStatusNotify discards any stop
      // inside SPURIOUS_STOP_WINDOW_MS (250ms) of the clause starting, because
      // a start seek raises a stop of its own that would otherwise re-enable
      // Record before the user has heard anything - the comment there says as
      // much, that very-early pauses are treated like start-seek noise by
      // design. A genuine early pause lands in the same window and goes with
      // it, and nothing else sets currentClausePlayed, so Record stays off
      // until the segment is played again and allowed to run. That is exactly
      // the quick-fails/slow-works behaviour seen by hand. (The window is the
      // predicted mechanism and it matches the observation; it has not been
      // confirmed against a captured failing run.)
      //
      // WHAT NEEDS FIXING. Tell the two stops apart by something other than
      // elapsed time - the synthetic one follows a seek the step itself asked
      // for, so it is knowable - rather than moving the window, which only
      // trades this defect for Record enabling before the clause has been
      // heard.
      //
      // Intermittent here for a different reason than the defect itself: the
      // pause below is preceded by several Cypress commands, so whether the
      // click lands inside the 250ms window varies run to run. By hand it is
      // not intermittent at all - a quick pause fails every time.
      mountPbt({ segments: SEGMENTS, existingTakes: [0] });
      expectRecordNotVisible();
      unitLabel('0:03', '0:06').should('be.visible');
      expectRecordEnabled();

      clickSegmentUntilSelected(0);
      unitLabel('0:00', '0:03').should('be.visible');
      expectTakePresent();

      // Play the recording for segment 0
      cy.get(`#${PBT.container} #wsAudioPlay`)
        .not('#detailplayer #wsAudioPlay')
        .as('takePlay');
      cy.get('@takePlay', { timeout: 20000 }).should('not.be.disabled').click();
      cy.get('@takePlay').find('svg[data-testid="PauseIcon"]').should('exist');

      // Change to segment 1
      clickSegmentUntilSelected(1);
      unitLabel('0:03', '0:06').should('be.visible');
      cy.get('@takePlay')
        .find('svg[data-testid="PlayArrowIcon"]')
        .should('exist');

      // Pause segment 1 - this is the quick pause the defect is about
      sourcePlay().then(($play) => {
        if ($play.find('svg[data-testid="PauseIcon"]').length) {
          cy.wrap($play).click();
        }
      });

      cy.get('@takePlay')
        .find('svg[data-testid="PlayArrowIcon"]')
        .should('exist');
      cy.wait(200);
      expectRecordEnabled();
    }
  );
});
