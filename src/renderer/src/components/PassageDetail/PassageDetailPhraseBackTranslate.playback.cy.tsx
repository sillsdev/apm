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
 * starting a segment used to produce.
 */
import {
  mountPbt,
  waitForPbtReady,
  startRecordingPass,
  sampleDom,
  readSourcePlaying,
  playheadText,
  parseTime,
  pbtCleanup,
  PBT,
  SEGMENTS_3,
  unitLabel,
} from '../../../cypress/support/pbtHarness';

const SEGMENTS = SEGMENTS_3;

/**
 * A last clause too short for the step's own effects to intervene before it
 * ends. On a normal clause the step stops playback itself when the overshoot
 * lands, which hides whether the engine reported its own stop; a sliver leaves
 * the engine's report as the only one there is.
 */
const SEGMENTS_SHORT_LAST = [
  { start: 0, end: 3 },
  { start: 3, end: 6 },
  { start: 6, end: 6.2 },
];

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
    cy.get(PBT.nextUnit).click();
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

  it('stops at the end of the segment without running into the next', () => {
    cy.get(PBT.nextUnit).click();
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
    // durationSec pinned to the last segment's end so the segment finishes
    // exactly where the file does, which is the case that was reported.
    mountPbt({ segments: SEGMENTS_SHORT_LAST, durationSec: 6.2 });
    waitForPbtReady();
    startRecordingPass();
  });

  it('reports the stop when the last segment ends at the end of the audio', () => {
    // The case seen by hand: the final segment finished where the file did.
    // Seeking to exactly the duration pauses the media element directly
    // (useWaveSurfer wsGoto), and onPlayStatus is only ever raised from the
    // imperative setPlaying - so that pause is invisible to the app. The audio
    // stopped part way along with the pause icon still up, and the step, reading
    // a playing state that never went false, never offered Record again.
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:06').should('be.visible');
    cy.wait(3000);
    cy.document().then((doc) => {
      expect(
        readSourcePlaying(doc),
        'play/pause button back to Play once the audio ran out'
      ).to.equal(false);
    });
  });
});

describe('PBT region playback contract, short last segment clear of the file end', () => {
  beforeEach(() => {
    mountPbt({ segments: SEGMENTS_SHORT_LAST, durationSec: 8 });
    waitForPbtReady();
    startRecordingPass();
  });

  it('reports the stop when a short last segment finishes playing', () => {
    // The last segment has no following region to overshoot into, so nothing
    // stops it explicitly, and the engine's own pause at the end of a bounded
    // play goes unreported - onPlayStatus is only ever raised from the imperative
    // setPlaying. The pause icon stays up and every consumer reading the playing
    // state stays desynchronised (TT-7621). A normal-length clause hides this,
    // because the step intervenes before the end; a sliver does not.
    cy.get(PBT.nextUnit).click();
    unitLabel('0:03', '0:06').should('be.visible');
    cy.get(PBT.nextUnit).click();
    unitLabel('0:06', '0:06').should('be.visible');
    cy.wait(3000);
    cy.document().then((doc) => {
      expect(
        readSourcePlaying(doc),
        'play/pause button back to Play once the last segment ended'
      ).to.equal(false);
    });
  });
});
