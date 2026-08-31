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
  fileurlRequestedIds,
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
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

afterEach(() => pbtCleanup());

describe('PBT listen pass', () => {
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

describe('PBT record enablement', () => {
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

/**
 * A team can configure one PBT step per language, so the same passage carries
 * takes from several of them, recorded against the very same segment. A step
 * must only ever see - and play - its own language's takes (TT-7643).
 */
describe('PBT language scoping', () => {
  it('loads this step language take when another language has one too', () => {
    mountPbt({
      segments: SEGMENTS,
      stepLanguage: 'Hebrew|he',
      existingTakeRows: [
        // Higher remote id than the Hebrew take, so a chooser that ignores
        // language would land on the Sena one.
        {
          segmentIndex: 0,
          languagebcp47: 'Sena|seh',
          remoteId: '999',
          performedBy: 'Sena Speaker',
        },
        {
          segmentIndex: 0,
          languagebcp47: 'Hebrew|he',
          remoteId: '101',
          performedBy: 'Hebrew Speaker',
        },
        // Hebrew is finished, so the step opens in review mode on segment 1
        // with its take mounted in the recorder - the moment the wrong take
        // would become audible.
        {
          segmentIndex: 1,
          languagebcp47: 'Hebrew|he',
          remoteId: '102',
          performedBy: 'Hebrew Speaker',
        },
        {
          segmentIndex: 2,
          languagebcp47: 'Hebrew|he',
          remoteId: '103',
          performedBy: 'Hebrew Speaker',
        },
      ],
    });
    waitForPbtReady();

    cy.wrap(null, { timeout: 20000 }).should(() => {
      expect(
        fileurlRequestedIds().length,
        'a take was loaded'
      ).to.be.greaterThan(0);
    });
    cy.then(() => {
      expect(
        fileurlRequestedIds(),
        'only this step language was ever fetched'
      ).to.not.include('999');
      expect(fileurlRequestedIds()[0]).to.equal('101');
    });
  });

  it('treats another language take as no take at all', () => {
    mountPbt({
      segments: SEGMENTS,
      stepLanguage: 'Hebrew|he',
      existingTakeRows: [
        {
          segmentIndex: 0,
          languagebcp47: 'Sena|seh',
          remoteId: '999',
          performedBy: 'Sena Speaker',
        },
      ],
    });
    waitForPbtReady();

    // Nothing recorded in Hebrew yet: the listen pass, not review mode.
    cy.get(PBT.start).should('be.visible');
    expectSegmentColors([
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.pending,
    ]);
    cy.then(() =>
      expect(fileurlRequestedIds(), 'no foreign take fetched').to.not.include(
        '999'
      )
    );
  });
});
