/**
 * TT-7621 regression test for the Phrase Back Translate bootstrap.
 *
 * `PassageDetailGuidedPhraseRecord` runs a 250ms poll that calls
 * `ensureSegments()` until it returns true. When auto-segment legitimately finds
 * no boundaries (e.g. audio the silence math cannot split) `ensureSegments`
 * returned false forever, so the poll — and its effect churn — never stopped.
 *
 * With audio actually loaded (duration > 0) it must instead fall back to a
 * single full-length segment and return true, so the step can settle. Returning
 * false stays correct only while the player has no audio yet.
 */
import { renderHook, act } from '@testing-library/react';

jest.mock('../Internalization/useProjectSegmentSave', () => ({
  useProjectSegmentSave: () => jest.fn().mockResolvedValue(undefined),
}));

import { useGuidedPhraseSegments } from './useGuidedPhraseSegments';
import { hasPhraseRegions } from './carefulSpeechBoundary';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeControls(overrides: Record<string, unknown> = {}): any {
  return {
    current: {
      isReady: () => true,
      getDuration: () => 10,
      runAutoSegment: jest.fn().mockResolvedValue(0),
      getRegionsJson: () => '{}',
      loadRegionsJson: jest.fn(),
      applyRegionColors: jest.fn(),
      ...overrides,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mediafile: any = { id: 'v1', attributes: { segments: '[]' } };

describe('useGuidedPhraseSegments.ensureSegments (TT-7621)', () => {
  it('falls back to one full-length segment when auto-segment finds none', async () => {
    const controls = makeControls();
    const { result } = renderHook(() =>
      useGuidedPhraseSegments(mediafile, controls, {
        namedRegion: 'BT:en',
        persistSegments: true,
      })
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.ensureSegments();
    });

    expect(ok).toBe(true);
    expect(hasPhraseRegions(result.current.phraseSegString)).toBe(true);
  });

  it('still returns false while the player has no audio loaded', async () => {
    const controls = makeControls({ getDuration: () => 0 });
    const { result } = renderHook(() =>
      useGuidedPhraseSegments(mediafile, controls, {
        namedRegion: 'BT:en',
        persistSegments: true,
      })
    );

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.ensureSegments();
    });

    expect(ok).toBe(false);
  });
});
