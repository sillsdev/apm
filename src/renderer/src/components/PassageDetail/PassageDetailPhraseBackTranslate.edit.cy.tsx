/**
 * Phrase Back Translate - revisiting, deleting, re-recording, boundary tools,
 * failed uploads, and rough handling.
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
  expectSegmentColors,
  expectSegmentCount,
  recordTake,
  expectRecordEnabled,
  expectRecordDisabled,
  expectTakePresent,
  expectNoTakePresent,
  succeedFurtherUploads,
  pbtCleanup,
  SEGMENT_COLOR,
  PBT,
  SEGMENTS_3,
  unitLabel,
  startRecordingPass,
  recordAndSettle,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

afterEach(() => pbtCleanup());

describe('PBT returning to a recorded segment (TT-7561)', () => {
  it('still shows the take after navigating away and back', () => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
    recordAndSettle(1);

    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    cy.get(PBT.prevUnit).click();
    unitLabel('0:00', '0:03').should('be.visible');

    // The segment is recorded, so the user must see the take (and must not be
    // invited to record over it).
    expectTakePresent();
    expectRecordDisabled();
  });

  it('shows it as recorded even when the upload reaches rowData late', () => {
    mountPbt({ segments: SEGMENTS, rowDataLagMs: 4000 });
    waitForPbtReady();
    startRecordingPass();
    recordTake();
    waitForUploads(1);

    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    cy.get(PBT.prevUnit).click();
    unitLabel('0:00', '0:03').should('be.visible');
    expectRecordDisabled();
  });
});

describe('PBT delete and re-record', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
    recordAndSettle(1);
  });

  it('re-enables Record after the take is cleared', () => {
    cy.get('[aria-label="Clear Recording"]').click();
    expectRecordEnabled();
    expectNoTakePresent();
  });

  it('saves the replacement take against the same segment', () => {
    cy.get('[aria-label="Clear Recording"]').click();
    recordTake();
    waitForUploads(2);
    cy.then(() => {
      expect(postedTakes()[1].parsedSegments).to.deep.include({
        start: 0,
        end: 3,
      });
    });
  });

  it('drops the segment back to pending when its take is deleted', () => {
    cy.get('[aria-label="Clear Recording"]').click();
    expectRecordEnabled();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectSegmentColors([
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
    ]);
  });
});

describe('PBT segment boundary tools', () => {
  it('combines the current segment with the next and records the merged span', () => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();

    cy.get(PBT.combine).click();
    unitLabel('0:00', '0:06').should('be.visible');
    expectSegmentCount(2);

    expectRecordEnabled();
    recordTake();
    waitForUploads(1);
    cy.then(() => {
      expect(
        postedTakes()[0].parsedSegments,
        'take covers the merged segment'
      ).to.deep.include({ start: 0, end: 6 });
    });
  });

  it('will not combine away a segment that is already recorded', () => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
    recordAndSettle(1);
    cy.get(PBT.combine).should('be.disabled');
  });

  it('locks the boundary tools while recording', () => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
    cy.get(PBT.recordButton).click();
    cy.get(`${PBT.dockedRecord} svg[data-testid="StopIcon"]`, {
      timeout: 15000,
    }).should('exist');
    cy.get(PBT.combine).should('be.disabled');
    cy.get(PBT.split).should('be.disabled');
    cy.get(PBT.prevUnit).should('be.disabled');
    cy.get(PBT.nextUnit).should('be.disabled');
    cy.get(PBT.recordButton).click();
  });

  it('splits the current segment at its interior silence', () => {
    // 0-6 has a silence at 3s, so a split point exists inside it.
    mountPbt({
      segments: [
        { start: 0, end: 6 },
        { start: 6, end: 9 },
      ],
      audioBoundaries: [3, 6],
    });
    waitForPbtReady();
    startRecordingPass();
    cy.get(PBT.split).should('not.be.disabled').click();
    expectSegmentCount(3);
    unitLabel('0:00', '0:03').should('be.visible');
  });
});

describe('PBT save failure', () => {
  it('offers Retry when the upload is rejected and keeps the segment pending', () => {
    mountPbt({ segments: SEGMENTS, failPostWithStatus: 400 });
    waitForPbtReady();
    startRecordingPass();
    recordTake();

    cy.contains('Upload Failed', { timeout: 25000 }).should('be.visible');
    cy.get(PBT.retrySave).should('not.be.disabled');
    // The take is not stored, so the segment must not read as done, and Record
    // must stay off until the user deliberately discards the take.
    expectRecordDisabled();
    expectTakePresent();
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    expectSegmentColors([
      SEGMENT_COLOR.pending,
      SEGMENT_COLOR.current,
      SEGMENT_COLOR.pending,
    ]);
  });

  it('saves the take when Retry succeeds', () => {
    mountPbt({ segments: SEGMENTS, failPostWithStatus: 400 });
    waitForPbtReady();
    startRecordingPass();
    recordTake();
    cy.contains('Upload Failed', { timeout: 25000 }).should('be.visible');

    cy.then(() => succeedFurtherUploads());
    cy.get(PBT.retrySave).click();
    waitForUploads(1);
    cy.then(() => {
      expect(postedTakes()[0].parsedSegments).to.deep.include({
        start: 0,
        end: 3,
      });
    });
    cy.contains('Upload Failed').should('not.exist');
  });

  it('lets the user discard a failed take and record again', () => {
    mountPbt({ segments: SEGMENTS, failPostWithStatus: 400 });
    waitForPbtReady();
    startRecordingPass();
    recordTake();
    cy.contains('Upload Failed', { timeout: 25000 }).should('be.visible');

    cy.get('[aria-label="Clear Recording"]').click();
    cy.contains('Upload Failed').should('not.exist');
    expectRecordEnabled();
  });
});

describe('PBT rough handling', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
  });

  it('survives a very short record/stop burst', () => {
    startRecordingPass();
    cy.get(PBT.recordButton).click();
    cy.get(PBT.recordButton).click({ force: true });
    cy.wait(3000);
    cy.get(`#${PBT.container}`).should('exist');
    cy.then(() => {
      const takes = postedTakes();
      expect(takes.length, 'at most one take').to.be.lessThan(2);
      takes.forEach((t) =>
        expect(t.parsedSegments).to.deep.include({ start: 0, end: 3 })
      );
    });
  });

  it('does not leave two segments selected after fast next/prev taps', () => {
    startRecordingPass();
    cy.get(PBT.nextUnit).click();
    cy.get(PBT.nextUnit).click({ force: true });
    cy.get(PBT.prevUnit).click({ force: true });
    cy.wait(1500);
    segmentColors().then((colors) => {
      const current = colors.filter((c) => c === SEGMENT_COLOR.current);
      expect(current, 'exactly one current segment').to.have.length(1);
    });
  });

  it('keeps the selected segment and the label in step after Start Recording', () => {
    cy.get(PBT.start).click();
    expectRecordEnabled();
    cy.window().should((win) => {
      expect(win.__pbt?.currentSegment()).to.deep.include({ start: 0, end: 3 });
    });
    unitLabel('0:00', '0:03').should('be.visible');
  });
});

/**
 * Kept last on purpose. Pre-loading takes makes the recorder fetch and decode
 * their audio, and a mount that follows it in the same document has been seen
 * to lose source playback (the auto-play never reaches region-out, so Record
 * never enables). Nothing after it means nothing to destabilise.
 */
describe('PBT review mode', () => {
  it('opens straight into review when every segment is already recorded', () => {
    mountPbt({ segments: SEGMENTS, existingTakes: [0, 1, 2] });
    waitForPbtReady();
    // Review mode: recorder docked, nothing to record, takes playable.
    cy.get(PBT.dockedRecord).should('exist');
    expectRecordDisabled();
    cy.get(PBT.start).should('not.exist');
  });
});
