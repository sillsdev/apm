import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { MediaFileD } from '../../../model';
import { WSAudioPlayerControls } from '../../WSAudioPlayer';
import { phraseBtBoundaryRegionName } from './matchesGuidedOutputRow';

/**
 * TT-7643 - a Phrase BT step per language reads its own `BT:<bcp47>` boundary
 * bucket off the same vernacular audio. The reset has to key on that bucket as
 * well as the mediafile, or a step change is rejected as "same audio, nothing
 * to do" and the next language opens on the previous language's boundaries.
 */

jest.mock('../Internalization/useProjectSegmentSave', () => ({
  useProjectSegmentSave: () => jest.fn().mockResolvedValue(undefined),
}));

import { useGuidedPhraseSegments } from './useGuidedPhraseSegments';

const bucket = (name: string, regions: { start: number; end: number }[]) => ({
  name,
  regionInfo: JSON.stringify({ params: {}, regions }),
});

const SENA = [{ start: 0, end: 11 }];
const HEBREW = [
  { start: 0, end: 4 },
  { start: 4, end: 9 },
];

const mediafile = {
  id: 'mf-vern',
  type: 'mediafile',
  attributes: {
    segments: JSON.stringify([
      bucket(phraseBtBoundaryRegionName('seh'), SENA),
      bucket(phraseBtBoundaryRegionName('he'), HEBREW),
    ]),
  },
  relationships: {},
} as unknown as MediaFileD;

const controlsRef = createRef<WSAudioPlayerControls>() as React.RefObject<
  WSAudioPlayerControls | undefined
> as React.RefObject<WSAudioPlayerControls | null>;

const regionsOf = (json: string) =>
  (JSON.parse(json) as { regions?: { start: number; end: number }[] }).regions;

describe('useGuidedPhraseSegments - reset scope', () => {
  it('re-reads boundaries when the language bucket changes on the same audio', () => {
    const { result, rerender } = renderHook(
      ({ namedRegion }: { namedRegion: string }) =>
        useGuidedPhraseSegments(mediafile, controlsRef, { namedRegion }),
      { initialProps: { namedRegion: phraseBtBoundaryRegionName('seh') } }
    );

    act(() => result.current.resetForScope(mediafile.id));
    expect(regionsOf(result.current.phraseSegString)).toEqual(SENA);

    // Same vernacular, next language's step.
    rerender({ namedRegion: phraseBtBoundaryRegionName('he') });
    act(() => result.current.resetForScope(mediafile.id));
    expect(regionsOf(result.current.phraseSegString)).toEqual(HEBREW);
  });

  it('stays put when neither the audio nor the bucket moved', () => {
    const { result } = renderHook(() =>
      useGuidedPhraseSegments(mediafile, controlsRef, {
        namedRegion: phraseBtBoundaryRegionName('he'),
      })
    );

    act(() => result.current.resetForScope(mediafile.id));
    act(() => result.current.setPhraseSegString('{"params":{},"regions":[]}'));
    // A repeat call must not undo work done since - the guard that keeps
    // StrictMode's double-invoke from clobbering a started pass (TT-7360).
    act(() => result.current.resetForScope(mediafile.id));
    expect(regionsOf(result.current.phraseSegString)).toEqual([]);
  });
});
