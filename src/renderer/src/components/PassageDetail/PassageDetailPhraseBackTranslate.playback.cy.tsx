/**
 * Phrase Back Translate - the shared region-playback contract.
 *
 * These do not test the step so much as the waveform engine underneath it:
 * `wsPlayRegion` in useWaveSurferRegions, and what it reports while playing one
 * segment. Phrase Back Translate is only the vehicle, because pbtHarness is the
 * one harness that mounts a real wavesurfer with real regions.
 *
 * The same code path is what Careful Speech plays every clause through, what
 * Mark Verses and Transcribe reach via their Prev/Next segment buttons, what
 * PassageDetailItem uses under `forceRegionOnly`, and what Discuss plays a topic
 * region with. None of those has a real-player harness, so anything asserted
 * here is the closest thing they have to a regression test - keep them passing.
 *
 * What is NOT covered here, and needs hand testing in those steps: where the
 * playhead is left sitting after a segment play (Mark Verses edits verse
 * references against it), and any effect timed to the pause-and-resume blip that
 * starting a segment produces.
 *
 * Nor is the play/pause icon after the last segment. It is genuinely wrong when
 * the segment ends where the audio does - the engine's own pause there is never
 * reported, see ADR 0011 - but whether it shows depends on whether the playhead
 * lands exactly on the boundary, so an assertion on it flips between runs.
 * Asserting it would buy a flaky test rather than coverage; what mattered about
 * it - that the unreported stop no longer strands the step - is asserted below.
 */
import {
  mountPbt,
  waitForPbtReady,
  startRecordingPass,
  readSourcePlaying,
  readRecordEnabled,
  playheadText,
  parseTime,
  expectRecordEnabled,
  sourcePlay,
  pbtCleanup,
  SEGMENTS_3,
  unitLabel,
  clickSegmentUntilSelected,
  expectTakePresent,
  PBT,
  expectRecordNotVisible,
  expectRecordDisabled,
  waitForSourceStopped as waitForSourceToStop,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

afterEach(() => pbtCleanup());

describe('PBT region playback contract', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS });
    waitForPbtReady();
    startRecordingPass();
  });

  it('plays a segment from its start, not from part way in', () => {
    // Starting a segment seeks twice - into the region, then back to its start -
    // and today a spurious region-out pauses and re-seeks in between, which
    // replays the opening. Anything that removes that blip must still begin at
    // the segment start: beginning 100ms in would clip the first syllable, which
    // is exactly what the reference audio is for.
    clickSegmentUntilSelected(1);
    unitLabel('0:03', '0:06').should('be.visible');
    cy.document().should((doc) => {
      expect(readSourcePlaying(doc), 'reference audio started').to.equal(true);
    });
    playheadText().then((t) => {
      expect(
        parseTime(t),
        'playhead near the start of segment 2, not part way in'
      ).to.be.lessThan(3.6);
    });
  });

  it('keeps Record off while the user replays a segment they have heard', () => {
    // Found in review. The step withholds Record for the clause span whenever it
    // starts playback itself, but a user pressing Play to hear a segment again
    // never goes through that path - and by then the clause counts as heard, so
    // Record is operable and can be pressed over the reference audio.
    clickSegmentUntilSelected(1);
    unitLabel('0:03', '0:06').should('be.visible');
    expectRecordEnabled(); // heard once, Record now offered

    sourcePlay().click(); // replay it
    cy.document().should((doc) => {
      expect(readSourcePlaying(doc), 'replay started').to.equal(true);
    });
    cy.wait(800);
    cy.document().then((doc) => {
      expect(readSourcePlaying(doc), 'replay still playing').to.equal(true);
      expect(
        readRecordEnabled(doc),
        'Record withheld while the segment is replayed'
      ).to.equal(false);
    });
  });

  it('stops at the end of the segment without running into the next', () => {
    clickSegmentUntilSelected(1);
    unitLabel('0:03', '0:06').should('be.visible');
    // Segment 2 runs 0:03-0:06. Wait out its span plus slack, then require the
    // playhead to be no further than a moment past its end - running on would
    // play segment 3's audio under segment 2's label.
    cy.wait(5000);
    cy.document().should((doc) => {
      expect(readSourcePlaying(doc), 'playback stopped').to.equal(false);
    });
    playheadText().then((t) => {
      expect(
        parseTime(t),
        'playhead did not run into segment 3'
      ).to.be.lessThan(6.5);
    });
  });
});

describe('PBT region playback contract, last segment ends with the audio', () => {
  beforeEach(() => {
    // durationSec pinned to the last segment's end, so that segment finishes
    // exactly where the file does. That, not the segment being short, is the
    // condition that was reported - a sliver at the end of a 6s file makes the
    // fixture itself unreliable, and the segment length is beside the point.
    mountPbt({ segments: SEGMENTS, durationSec: 9 });
    waitForPbtReady();
    startRecordingPass();
  });

  it('enables Record when the last segment ends at the end of the audio', () => {
    clickSegmentUntilSelected(1);
    unitLabel('0:03', '0:06').should('be.visible');

    clickSegmentUntilSelected(2);
    unitLabel('0:06', '0:09').should('be.visible');
    expectRecordDisabled();

    // Wait for the segment end
    waitForSourceToStop();

    cy.wait(200);
    expectRecordEnabled();
  });
});

describe('PBT playback when changing segments', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS, existingTakes: [0] });
    expectRecordNotVisible();
    unitLabel('0:03', '0:06').should('be.visible');
    expectRecordEnabled();
  });

  it('stops the player when the current segment changes', () => {
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

    // Pause segment 1
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
  });
});
