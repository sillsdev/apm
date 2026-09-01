/**
 * Phrase Back Translate - selecting a segment on the waveform.
 *
 * Three behaviours reported from hand testing, all of which turn out to be the
 * same fault seen from different angles: a segment click is only half applied.
 * The waveform selection (yellow) and the playhead move, but the step's own
 * current segment - the "Segment: m:ss - m:ss" label, and the segment a take
 * gets filed under - does not follow.
 *
 *  1. the yellow selection is briefly on the wrong segment;
 *  2. recording 1, then 3, then going back to 2 files the take on 3;
 *  3. Record is operable while a newly clicked segment plays.
 *
 * Some of these are transient, so they are caught by sampling the DOM rather
 * than by a settled assertion.
 *
 * The harness (fake microphone, fake server, real everything else) lives in
 * cypress/support/pbtHarness.tsx.
 */
import {
  mountPbt,
  waitForPbtReady,
  postedTakes,
  waitForUploads,
  recordTake,
  expectRecordEnabled,
  clickSegmentOnWaveform,
  sampleDom,
  readCurrentSegmentIndex,
  readLabelSegmentIndex,
  readSourcePlaying,
  readRecordEnabled,
  pbtCleanup,
  PBT,
  SEGMENTS_3,
  unitLabel,
  startRecordingPass,
  recordAndSettle,
  tapSegmentOnEngine,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

afterEach(() => pbtCleanup());

describe('PBT waveform segment selection', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
  });

  it('selects a clicked segment and plays it', () => {
    clickSegmentOnWaveform(2);
    unitLabel('0:06', '0:09').should('be.visible');
  });

  it('acts on the first click even on the very next segment', () => {
    // After a segment finishes playing, handleRegionPlayEnd arms
    // pendingOvershootSwallowRef so the +1 segment change that playback
    // overshoot produces can be absorbed. It could not tell that change apart
    // from the user clicking the next segment, so the click was swallowed too:
    // the playhead snapped back, the label never changed, and the user had to
    // click again. The player now reports a click distinctly, which disarms the
    // swallow.
    clickSegmentOnWaveform(1);
    unitLabel('0:03', '0:06').should('be.visible');
  });

  it('keeps Record off while a clicked segment plays', () => {
    clickSegmentOnWaveform(2);
    unitLabel('0:06', '0:09').should('be.visible');

    // One reading, taken from the middle of the segment. `playing` is the
    // player's own state and Record's operability is the step's, so at either
    // end of playback the two flip on unrelated renders and a sample can
    // legitimately catch both live for a frame. Segment 3 runs 0:06-0:09, so
    // waiting for playback to start and then settling for most of a second
    // lands clear of both edges. Asserting `playing` in the same reading is
    // what makes the Record assertion mean anything.
    cy.document().should((doc) => {
      expect(readSourcePlaying(doc), 'reference audio started').to.equal(true);
    });
    cy.wait(800);
    cy.document().then((doc) => {
      const playing = readSourcePlaying(doc);
      const record = readRecordEnabled(doc);
      expect(playing, 'reference audio still playing').to.equal(true);
      expect(
        record,
        'Record operable while the reference audio plays'
      ).to.equal(false);
    });
  });
});

describe('PBT segment selection after a take exists', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
    recordAndSettle(1); // a take on segment 1 - the precondition that matters
  });

  it('keeps Record off while a newly clicked segment plays', () => {
    // Reported: "if I click on a unselected segment to select it, it starts
    // playing, but the record button is enabled while playing so I can record
    // during playing which should not be possible". Recording over the reference
    // audio is what the listen-then-record flow prevents everywhere else, and
    // Record was correctly off for this same click before any take existed (see
    // the previous describe) - a take on segment 1 was the difference.
    //
    // One reading from the middle of playback, for the reason the sibling test
    // above gives: `playing` is the player's state and Record's operability is
    // the step's, so at either end of playback the two flip on unrelated renders
    // and a sample can legitimately catch both live for a frame. Segment 3 runs
    // 0:06-0:09, so settling for most of a second after playback starts lands
    // clear of both edges.
    clickSegmentOnWaveform(2);
    cy.document().should((doc) => {
      expect(readSourcePlaying(doc), 'reference audio started').to.equal(true);
    });
    cy.wait(800);
    cy.document().then((doc) => {
      const playing = readSourcePlaying(doc);
      const record = readRecordEnabled(doc);
      expect(playing, 'reference audio still playing').to.equal(true);
      expect(
        record,
        'Record operable while the reference audio plays'
      ).to.equal(false);
    });
  });

  it(
    'DEFECT: the waveform selection and the segment label disagree',
    { tags: '@known-defect' },
    () => {
      // Reported as "the yellow highlighting briefly jumps to the next segment".
      // The waveform paints from the engine's currentSegmentIndex while the
      // label comes from the step's own currentIndex, so any segment change the
      // step does not act on shows up as the two disagreeing. Fixed separately -
      // this change only stops the click itself being swallowed.
      clickSegmentOnWaveform(2);

      sampleDom(
        (doc) => ({
          painted: readCurrentSegmentIndex(doc),
          labelled: readLabelSegmentIndex(doc, SEGMENTS),
        }),
        { forMs: 6000 }
      ).then((samples) => {
        const disagreeing = samples.filter(
          (s) => s.painted >= 0 && s.labelled >= 0 && s.painted !== s.labelled
        );
        expect(
          disagreeing.length,
          'selection and label always agreed (saw ' +
            JSON.stringify(disagreeing.slice(0, 5)) +
            ')'
        ).to.equal(0);
      });
    }
  );
});

describe('PBT recording out of order (1, 3, then 2)', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
  });

  /**
   * Reported: "record the first segment, right-arrow twice to the third, record
   * it, then left-arrow to the second. It auto-plays segment 2 as expected, but
   * afterwards segment 3 is highlighted, not the segment 2 I am about to
   * record."
   *
   * Parking after an auto-play arms the overshoot swallow, because playback
   * overshoot (or the recorder mounting) fires one spurious region-in on the
   * next clause. That swallow was only consulted after the completed-clause
   * branch, so when the clause the overshoot landed on already had a take -
   * segment 3 here - the step read the overshoot as a move onto it: the label,
   * the yellow selection and the phase all followed, and segment 2 went back to
   * pending under a user waiting to record it.
   *
   * tapSegmentOnEngine is the engine reporting a segment change with no click
   * behind it - exactly what that region-in looks like to the step.
   */
  it('keeps the parked segment when playback overshoots onto a recorded one', () => {
    recordAndSettle(1); // segment 1
    cy.get(PBT.nextUnit).click();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:09').should('be.visible');
    recordAndSettle(2); // segment 3

    cy.get(PBT.prevUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectRecordEnabled(); // segment 2's auto-play has parked

    tapSegmentOnEngine(2);
    // A settle window, not a race: the assertion below is that nothing moved,
    // and a retrying `should` would satisfy that on its first poll - before the
    // wrong behaviour (the completed-clause branch selecting segment 3) has had
    // a chance to happen. Give the effect time to misbehave, then look.
    cy.wait(1500);
    cy.document().then((doc) => {
      expect(
        readLabelSegmentIndex(doc, SEGMENTS),
        'the step is still on segment 2'
      ).to.equal(1);
      expect(
        readCurrentSegmentIndex(doc),
        'segment 2 is still the painted selection'
      ).to.equal(1);
    });
    expectRecordEnabled();

    recordTake();
    waitForUploads(3);
    cy.then(() => {
      const segs = postedTakes().map((t) => t.parsedSegments);
      expect(segs[2], 'the take lands on segment 2').to.deep.include({
        start: 3,
        end: 6,
      });
      const onSegment3 = segs.filter(
        (s) => s?.start === 6 && s?.end === 9
      ).length;
      expect(onSegment3, 'segment 3 still has exactly one take').to.equal(1);
    });
  });

  it('files each take under its own segment when navigating with the arrows', () => {
    recordAndSettle(1); // segment 1
    cy.get(PBT.nextUnit).click();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:09').should('be.visible');
    recordAndSettle(2); // segment 3

    cy.get(PBT.prevUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectRecordEnabled();
    recordTake();
    waitForUploads(3); // segment 2

    cy.then(() => {
      const segs = postedTakes().map((t) => t.parsedSegments);
      expect(segs[0], 'first take').to.deep.include({ start: 0, end: 3 });
      expect(segs[1], 'second take').to.deep.include({ start: 6, end: 9 });
      expect(segs[2], 'third take, recorded on segment 2').to.deep.include({
        start: 3,
        end: 6,
      });
    });
  });

  it('follows a click back to an earlier segment and files the take there', () => {
    // Reported: "I record the first segment, then the third, and then try to go
    // back and record the second, it records into and replaces the third".
    // The click moved the waveform selection to segment 2 while the step stayed
    // on segment 3, so the take was filed on segment 3 over the one already
    // there. The engine reports a 1-based segment index and the step sets a
    // 0-based one, so this move arrived carrying the index the step had just
    // written (engine 1+1 vs step 2) and the navigation effect never re-ran.
    recordAndSettle(1); // segment 1

    clickSegmentOnWaveform(2);
    unitLabel('0:06', '0:09').should('be.visible');
    recordAndSettle(2); // segment 3

    clickSegmentOnWaveform(1);
    unitLabel('0:03', '0:06').should('be.visible');
    recordTake();
    waitForUploads(3);

    cy.then(() => {
      const segs = postedTakes().map((t) => t.parsedSegments);
      expect(segs[2], 'take recorded on segment 2 lands there').to.deep.include(
        {
          start: 3,
          end: 6,
        }
      );
      const onSegment3 = segs.filter(
        (s) => s?.start === 6 && s?.end === 9
      ).length;
      expect(onSegment3, 'segment 3 still has exactly one take').to.equal(1);
    });
  });
});
