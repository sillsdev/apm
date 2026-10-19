import { renderHook } from '@testing-library/react';
import { MediaFile } from '../../model';
import { NamedRegions } from '../../utils/namedSegments';
import { SuggestedSegments, usePlayerLogic } from './usePlayerLogic';

const recordingARegions =
  '{"regions":[{"start":0,"end":1},{"start":1,"end":2}]}';
const recordingBSuggestion =
  '{"regions":[{"start":0,"end":4},{"start":4,"end":8}]}';

// The hook only reads a media file's id and segments.
const media = (id: string, segments: string) =>
  ({
    type: 'mediafile',
    id,
    attributes: { segments },
  }) as MediaFile;

const suggestion = (mediaId: string, segments: string): SuggestedSegments => ({
  mediaId,
  segments,
});

interface HookProps {
  playerMediafile: MediaFile | undefined;
  suggestedSegments: SuggestedSegments | undefined;
}

/** Renders the hook on recording A with A's regions suggested, and returns
 * every segmentation it publishes. */
const renderOnRecordingA = () => {
  const published: string[] = [];
  const fixed = {
    allowSegment: NamedRegions.Transcription,
    setDefaultSegments: (segments: string) => {
      published.push(segments);
    },
    setRequestPlay: jest.fn(),
    setInitialPosition: jest.fn(),
    mediafileRef: { current: undefined as MediaFile | undefined },
    segmentsRef: { current: '' },
    durationRef: { current: 0 },
    playingRef: { current: false },
  };
  const initialProps: HookProps = {
    playerMediafile: media('recording-a', recordingARegions),
    suggestedSegments: suggestion('recording-a', recordingARegions),
  };
  const { rerender } = renderHook(
    (props: HookProps) => usePlayerLogic({ ...fixed, ...props }),
    { initialProps }
  );
  return { published, rerender };
};

/**
 * TT-7661 / TT-7590: dividing one recording must not paint those regions on
 * the next recording or task. Task switches are a new media id.
 */
test('publishes the next recording segments when the media file changes', () => {
  const { published, rerender } = renderOnRecordingA();

  rerender({
    playerMediafile: media('recording-b', '{}'),
    suggestedSegments: suggestion('recording-a', recordingARegions),
  });

  expect(published.at(-1)).toBe('{}');
});

test('keeps a suggestion that arrives with the next recording', () => {
  const { published, rerender } = renderOnRecordingA();

  // Recording B's record is stale (one region) but its suggestion is current.
  rerender({
    playerMediafile: media('recording-b', '{"regions":[{"start":0,"end":8}]}'),
    suggestedSegments: suggestion('recording-b', recordingBSuggestion),
  });

  expect(published.at(-1)).toBe(recordingBSuggestion);
});

test('keeps recording A regions off B after an empty selection in between', () => {
  const { published, rerender } = renderOnRecordingA();
  const aSuggestion = suggestion('recording-a', recordingARegions);

  // The selected id has no media record, so the player media clears while
  // recording A's suggestion stays in place.
  rerender({ playerMediafile: undefined, suggestedSegments: aSuggestion });
  rerender({
    playerMediafile: media('recording-b', '{}'),
    suggestedSegments: aSuggestion,
  });

  expect(published.at(-1)).toBe('{}');
});

test('waits for recording B before showing a suggestion made for it', () => {
  const { published, rerender } = renderOnRecordingA();
  const bSuggestion = suggestion('recording-b', recordingBSuggestion);

  // B's suggestion lands a render before the player switches to B.
  rerender({
    playerMediafile: media('recording-a', recordingARegions),
    suggestedSegments: bSuggestion,
  });
  expect(published).not.toContain(recordingBSuggestion);

  rerender({
    playerMediafile: media('recording-b', '{}'),
    suggestedSegments: bSuggestion,
  });
  expect(published.at(-1)).toBe(recordingBSuggestion);
});

test('ignores a suggestion for recording A once B is showing', () => {
  const { published, rerender } = renderOnRecordingA();
  const recordingB = media('recording-b', '{}');

  rerender({
    playerMediafile: recordingB,
    suggestedSegments: suggestion('recording-a', recordingARegions),
  });
  // A's segmentation changes after the switch.
  rerender({
    playerMediafile: recordingB,
    suggestedSegments: suggestion('recording-a', recordingBSuggestion),
  });

  expect(published.at(-1)).toBe('{}');
  expect(published).not.toContain(recordingBSuggestion);
});
