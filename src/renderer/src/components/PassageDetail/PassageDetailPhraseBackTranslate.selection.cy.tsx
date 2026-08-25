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

  it(
    'DEFECT: the first click on the very next segment is ignored',
    { tags: '@known-defect' },
    () => {
      // After a segment finishes playing, handleRegionPlayEnd arms
      // pendingOvershootSwallowRef so the +1 segment change that playback
      // overshoot produces can be absorbed. It cannot tell that change apart from
      // the user clicking the next segment, so the click is swallowed too: the
      // playhead snaps back, the label never changes, and the user has to click
      // again. Record also stays enabled for the segment they were leaving.
      clickSegmentOnWaveform(1);
      unitLabel('0:03', '0:06').should('be.visible');
    }
  );

  it('keeps Record off while a clicked segment plays', () => {
    clickSegmentOnWaveform(2);
    unitLabel('0:06', '0:09').should('be.visible');

    sampleDom(
      (doc) => ({
        playing: readSourcePlaying(doc),
        record: readRecordEnabled(doc),
      }),
      { forMs: 6000 }
    ).then((samples) => {
      const bothLive = samples.filter((s) => s.playing && s.record);
      expect(
        bothLive,
        'Record was never operable while the reference audio played'
      ).to.have.length(0);
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

  it(
    'DEFECT: Record is operable while a newly clicked segment plays',
    { tags: '@known-defect' },
    () => {
      // Reported: "if I click on a unselected segment to select it, it starts
      // playing, but the record button is enabled while playing so I can record
      // during playing which should not be possible". Recording over the
      // reference audio is what the listen-then-record flow prevents everywhere
      // else, and Record is correctly off for this same click before any take
      // exists (see the previous describe).
      clickSegmentOnWaveform(2);

      sampleDom(
        (doc) => ({
          playing: readSourcePlaying(doc),
          record: readRecordEnabled(doc),
        }),
        { forMs: 6000 }
      ).then((samples) => {
        const bothLive = samples.filter((s) => s.playing && s.record);
        expect(
          bothLive,
          'Record was never operable while the reference audio played'
        ).to.have.length(0);
      });
    }
  );

  it(
    'DEFECT: the waveform selection and the segment label disagree',
    { tags: '@known-defect' },
    () => {
      // Reported as "the yellow highlighting briefly jumps to the next segment".
      // The waveform paints from the engine's currentSegmentIndex while the label
      // comes from the step's own currentIndex; when a click only reaches the
      // engine, the two disagree - briefly in the good case, indefinitely in the
      // one below.
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

  it(
    'DEFECT: clicking back to segment 2 leaves the step on segment 3',
    { tags: '@known-defect' },
    () => {
      // Reported: "I record the first segment, then the third, and then try to
      // go back and record the second, it records into and replaces the third".
      // Clicking segment 2 moves the waveform selection and the playhead there,
      // but the step stays on segment 3 - so the next take is filed under
      // segment 3, on top of the take already there. Asserting the label is
      // enough: while it still reads segment 3, anything recorded goes to the
      // wrong segment.
      recordAndSettle(1); // segment 1

      clickSegmentOnWaveform(2);
      unitLabel('0:06', '0:09').should('be.visible');
      recordAndSettle(2); // segment 3

      clickSegmentOnWaveform(1);
      unitLabel('0:03', '0:06').should('be.visible');
    }
  );
});
