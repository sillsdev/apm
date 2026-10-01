/**
 * TT-7621 regression tests for the reference-audio blob loader.
 *
 * Two ways `useFetchMediaBlob` could leave the Phrase Back Translate step's top
 * player stuck on "Loading..." forever (context `loading` never clears because
 * `fetching.current` is never reset):
 *
 *  1. The signed URL resolves but the download is an error page (S3/CloudFront
 *     returns HTML/XML with a 200). The old code dispatched neither FETCHED nor
 *     ERROR for a text/html|application/xml blob, so `blobStat` stayed PENDING.
 *  2. A persistently-403 object drove an unbounded RESET->PENDING->403 loop,
 *     re-issuing a signed-URL request and a blob GET on every turn (the network
 *     storm in the hung-PBT report), and never reaching a terminal state.
 *
 * Both must end in ERROR so the caller can stop waiting.
 */
import { renderHook, act, waitFor } from '@testing-library/react';

const mockMediaClean = {
  status: 0,
  error: null,
  url: '',
  id: '',
  remoteId: '',
  cancelled: false,
};

// eslint-disable-next-line prefer-const
let mockMediaState: typeof mockMediaClean = { ...mockMediaClean };
const mockFetchMediaUrl = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockLoadBlob: (url: string, cb: (u: string, b?: Blob) => void) => void;

jest.mock('./useFetchMediaUrl', () => ({
  __esModule: true,
  mediaClean: mockMediaClean,
  default: () => ({
    fetchMediaUrl: mockFetchMediaUrl,
    mediaState: mockMediaState,
  }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, () => {}],
}));

jest.mock('../utils/loadBlob', () => ({
  loadBlob: (url: string, cb: (u: string, b?: Blob) => void) =>
    mockLoadBlob(url, cb),
}));

import { useFetchMediaBlob, BlobStatus } from './useFetchMediaBlob';

beforeEach(() => {
  mockMediaState = { ...mockMediaClean };
  mockFetchMediaUrl.mockReset();
});

describe('useFetchMediaBlob (TT-7621)', () => {
  it('dispatches ERROR (not a permanent PENDING) when the download is an error page', async () => {
    mockLoadBlob = (url, cb) =>
      cb(url, new Blob(['<Error>nope</Error>'], { type: 'application/xml' }));

    const { result, rerender } = renderHook(() => useFetchMediaBlob());
    act(() => {
      result.current[1]('m1');
    });

    // The signed URL arrives; the effect now runs loadBlob against it.
    mockMediaState = {
      ...mockMediaClean,
      id: 'm1',
      url: 'https://s3.invalid/x.wav',
    };
    act(() => {
      rerender();
    });

    await waitFor(() =>
      expect(result.current[0].blobStat).toBe(BlobStatus.ERROR)
    );
  });

  it('reaches a terminal ERROR after bounded 403 retries instead of looping forever', async () => {
    mockLoadBlob = (_url, cb) => cb('403 Forbidden', undefined);

    const { result, rerender } = renderHook(() => useFetchMediaBlob());
    act(() => {
      result.current[1]('m1');
    });

    // Feed a fresh signed URL each turn, exactly as a real re-request would, and
    // let the RESET/PENDING cycle run. It must converge, not spin.
    for (let i = 0; i < 16; i++) {
      mockMediaState = {
        ...mockMediaClean,
        id: 'm1',
        url: `https://s3.invalid/x.wav?sig=${i}`,
      };
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        rerender();
      });
      if (result.current[0].blobStat === BlobStatus.ERROR) break;
    }

    expect(result.current[0].blobStat).toBe(BlobStatus.ERROR);
  });
});
