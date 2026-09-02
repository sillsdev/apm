/**
 * Phrase Back Translate - listening, record enablement, and saving a take.
 *
 * Drives the real step as a user does and asserts what the user can see: is
 * Record enabled, where is the playhead, what colour is each segment, and -
 * read straight off the upload - which segment the take was filed under.
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
  expectSegmentColors,
  playheadText,
  parseTime,
  recordTake,
  expectRecordEnabled,
  expectRecordDisabled,
  expectTakePresent,
  expectNoTakePresent,
  pbtCleanup,
  SEGMENT_COLOR,
  PBT,
  SEGMENTS_3,
  unitLabel,
  sourcePlay,
  startRecordingPass,
  recordAndSettle,
  readSourcePlaying,
  readRecordEnabled,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

/**
 * A last clause far shorter than a normal one. Auto-segmenting can leave a
 * sliver at the end of the audio, and a user hit one by hand: it played, the
 * audio stopped part way along, and the step never offered Record again.
 */
const SEGMENTS_SHORT_LAST = [
  { start: 0, end: 3 },
  { start: 3, end: 6 },
  { start: 6, end: 6.2 },
];

afterEach(() => pbtCleanup());

describe('PBT listen pass', { tags: '@smoke' }, () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
  });

  it('opens on segment 1 with the listen-pass controls', () => {
    unitLabel('0:00', '0:03').should('be.visible');
    cy.get(PBT.start).should('be.visible');
    cy.get(PBT.more).should('be.visible');
    cy.get(PBT.fewer).should('be.visible');
    // No recorder yet: nothing to record against until Start Recording.
    cy.get(PBT.dockedRecord).should('not.exist');
  });

  it('colours the current segment and leaves the rest pending', () => {
    expectSegmentColors([
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.pending,
    ]);
  });

  it('advances to the next segment when one finishes playing', () => {
    sourcePlay().click();
    unitLabel('0:03', '0:06').should('be.visible');
    playheadText().then((t) => {
      expect(parseTime(t), 'playhead at segment 2 start').to.be.within(3, 4);
    });
    expectSegmentColors([
      SEGMENT_COLOR.completed, // "heard" during the listen pass
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
    ]);
  });
});

describe('PBT record enablement', { tags: '@smoke' }, () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
  });

  it('keeps Record disabled while the reference segment is auto-playing', () => {
    cy.get(PBT.start).click();
    // The recorder docks immediately; recording over the reference playback
    // must not be possible.
    cy.get(PBT.dockedRecord).should('exist');
    expectRecordDisabled();
  });

  it('enables Record once the segment has been heard, parked at its start', () => {
    startRecordingPass();
    playheadText().then((t) => {
      expect(parseTime(t), 'playhead parked at segment 1 start').to.be.lessThan(
        2
      );
    });
  });

  it('ignores Record taps while the reference audio is still playing', () => {
    cy.get(PBT.start).click();
    expectRecordDisabled();
    cy.get(PBT.recordButton).click({ force: true });
    cy.get(`${PBT.dockedRecord} svg[data-testid="StopIcon"]`).should(
      'not.exist'
    );
    expectRecordEnabled();
    cy.then(() => expect(postedTakes()).to.have.length(0));
  });
});

describe('PBT record and save', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
  });

  it('saves the take against the segment it was recorded on', () => {
    recordTake();
    waitForUploads(1);
    cy.then(() => {
      expect(postedTakes()[0].parsedSegments).to.deep.include({
        start: 0,
        end: 3,
      });
      expect(
        postedTakes()[0].languagebcp47,
        'stamped with the step language'
      ).to.equal('English|en');
      expect(postedTakes()[0].performedBy).to.equal('Tester');
    });
  });

  it('shows the take as recorded: Clear offered, Record off, segment green', () => {
    recordAndSettle(1);
    expectTakePresent();
    expectRecordDisabled();
    // The selected segment stays yellow; its green shows once we move on.
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectSegmentColors([
      SEGMENT_COLOR.completed,
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
    ]);
  });

  it('moves the playhead into the new segment on Next', () => {
    recordAndSettle(1);
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    playheadText().then((t) => {
      expect(parseTime(t), 'playhead inside segment 2').to.be.within(3, 6);
    });
  });

  it('keeps Record off while the segment reached by the arrow plays', () => {
    // Reported from hand testing: record segment 1, press the right arrow, and
    // segment 2 starts playing with Record still operable - so a take can be
    // recorded over the reference audio, which the listen-then-record flow
    // prevents everywhere else.
    recordAndSettle(1);
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');

    // One reading, taken from the middle of the segment. `playing` is the
    // player's own state and Record's operability is the step's, so at either
    // end of playback the two flip on unrelated renders and a sample can
    // legitimately catch both live for a frame. Segment 2 runs 0:03-0:06, so
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

  it('starts the next segment with an empty recorder', () => {
    recordAndSettle(1);
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectNoTakePresent();
  });

  it('marks the step complete once every segment is recorded', () => {
    recordAndSettle(1);
    cy.get(PBT.nextUnit).click();
    recordAndSettle(2);
    cy.get(PBT.nextUnit).click();
    recordAndSettle(3);
    cy.window().should((win) => {
      expect(win.__pbt?.stepComplete(), 'step complete').to.equal(true);
    });
  });
});

describe('PBT a clause shorter than the playback-start window', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS_SHORT_LAST });
    waitForPbtReady();
    startRecordingPass();
  });

  it('offers Record once a very short last clause has played', () => {
    // Reported from hand testing: the short clause auto-played, the playhead
    // stopped part way along, and the step was stuck - the pause icon stayed up
    // and Record never came back, so there was no way to record the clause.
    //
    // Telling the seek that starts a clause from the clause finishing by how
    // long playback has been running assumes clauses are longer than that
    // window. This one is not: its whole span is shorter, so the signal that
    // says "heard" arrives inside the window and is discarded as the seek.
    cy.get(PBT.nextUnit).click();
    expectRecordEnabled();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:06').should('be.visible');

    // The clause is 0.2s: by the time Record could be offered it has long
    // finished. Anything else is the dead state.
    expectRecordEnabled();
    cy.document().then((doc) => {
      expect(readSourcePlaying(doc), 'playback stopped').to.equal(false);
      expect(readRecordEnabled(doc), 'Record offered').to.equal(true);
    });
  });
});

describe('PBT out-of-order recording', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
  });

  it('records the last segment first without touching the others', () => {
    cy.get(PBT.nextUnit).click();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:09').should('be.visible');
    recordTake();
    waitForUploads(1);
    cy.then(() => {
      expect(postedTakes()[0].parsedSegments).to.deep.include({
        start: 6,
        end: 9,
      });
    });
    expectSegmentColors([
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.current,
    ]);
  });

  it('records backwards, each take against its own region', () => {
    cy.get(PBT.nextUnit).click();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:09').should('be.visible');
    recordAndSettle(1);

    cy.get(PBT.prevUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    recordAndSettle(2);

    cy.then(() => {
      const segs = postedTakes().map((t) => t.parsedSegments);
      expect(segs[0]).to.deep.include({ start: 6, end: 9 });
      expect(segs[1]).to.deep.include({ start: 3, end: 6 });
    });
  });
});
