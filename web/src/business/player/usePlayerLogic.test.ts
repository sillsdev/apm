import { renderHook } from '@testing-library/react';
import { MediaFile } from '../../model';
import { NamedRegions } from '../../utils/namedSegments';
import { usePlayerLogic } from './usePlayerLogic';

const recordingARegions =
  '{"regions":[{"start":0,"end":1},{"start":1,"end":2}]}';

const media = (id: string, segments: string) =>
  ({
    type: 'mediafile',
    id,
    attributes: { segments },
  }) as MediaFile;

/**
 * TT-7661 / TT-7590: dividing one recording must not paint those regions on
 * the next recording or task. Task switches are a new media id.
 */
test('publishes the next recording segments when the media file changes', () => {
  const published: string[] = [];
  const segmentsRef = { current: '' };
  const props = {
    allowSegment: NamedRegions.Transcription,
    suggestedSegments: recordingARegions,
    setDefaultSegments: (segments: string) => {
      published.push(segments);
    },
    setRequestPlay: jest.fn(),
    setInitialPosition: jest.fn(),
    playerMediafile: media('recording-a', recordingARegions),
    mediafileRef: { current: undefined as MediaFile | undefined },
    segmentsRef,
    durationRef: { current: 0 },
    playingRef: { current: false },
  };

  const { rerender } = renderHook(
    (hookProps: typeof props) => usePlayerLogic(hookProps),
    { initialProps: props }
  );

  rerender({
    ...props,
    playerMediafile: media('recording-b', '{}'),
    suggestedSegments: recordingARegions,
  });

  expect(published[published.length - 1]).toBe('{}');
});

test('keeps a suggestion that arrives with the next recording', () => {
  const published: string[] = [];
  const recordingBSuggestion =
    '{"regions":[{"start":0,"end":4},{"start":4,"end":8}]}';
  const props = {
    allowSegment: NamedRegions.Transcription,
    suggestedSegments: recordingARegions,
    setDefaultSegments: (segments: string) => {
      published.push(segments);
    },
    setRequestPlay: jest.fn(),
    setInitialPosition: jest.fn(),
    playerMediafile: media('recording-a', recordingARegions),
    mediafileRef: { current: undefined as MediaFile | undefined },
    segmentsRef: { current: '' },
    durationRef: { current: 0 },
    playingRef: { current: false },
  };

  const { rerender } = renderHook(
    (hookProps: typeof props) => usePlayerLogic(hookProps),
    { initialProps: props }
  );

  // Recording B's record is stale (one region) but its suggestion is current.
  rerender({
    ...props,
    playerMediafile: media('recording-b', '{"regions":[{"start":0,"end":8}]}'),
    suggestedSegments: recordingBSuggestion,
  });

  expect(published[published.length - 1]).toBe(recordingBSuggestion);
});
