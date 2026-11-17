// Web (non-Electron) read path of useFetchMediaUrl: Local Media Blob first,
// else the cloud url.
const mockFindLocalMediaBlob = jest.fn();
const mockFetchUrl = jest.fn();

jest.mock('../../api-variable', () => ({ isElectron: false }));
jest.mock('./findLocalMediaBlob', () => ({
  findLocalMediaBlob: (...args: unknown[]) => mockFindLocalMediaBlob(...args),
}));
jest.mock('./useFetchUrlNow', () => ({
  useFetchUrlNow: () => mockFetchUrl,
}));
jest.mock('../crud', () => ({
  remoteIdGuid: jest.fn(),
  remoteId: jest.fn(),
}));
jest.mock('../utils/dataPath', () => ({ dataPath: jest.fn(), PathType: {} }));
jest.mock('../utils', () => ({
  infoMsg: jest.fn(),
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [{ keyMap: {} }, jest.fn()],
  useGetGlobal: () => () => false,
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({ expiredToken: 'expired' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../selector', () => ({ sharedSelector: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { MediaSt, useFetchMediaUrl } from './useFetchMediaUrl';

const MEDIA_ID = 'b6c1e2f0-0000-4000-8000-000000000001';

describe('useFetchMediaUrl (web)', () => {
  const createObjectURL = jest.fn();
  const revokeObjectURL = jest.fn();

  beforeAll(() => {
    // jsdom has no object-url support.
    Object.assign(URL, { createObjectURL, revokeObjectURL });
  });

  beforeEach(() => {
    mockFindLocalMediaBlob.mockReset();
    mockFetchUrl.mockReset();
    createObjectURL.mockReset().mockReturnValue('blob:local-1');
    revokeObjectURL.mockReset();
  });

  it('plays the Local Media Blob without asking the cloud', async () => {
    const blob = new Blob(['abc'], { type: 'audio/mpeg' });
    mockFindLocalMediaBlob.mockResolvedValue(blob);
    const { result } = renderHook(() => useFetchMediaUrl());

    act(() => result.current.fetchMediaUrl({ id: MEDIA_ID }));

    await waitFor(() =>
      expect(result.current.mediaState.status).toBe(MediaSt.FETCHED)
    );
    expect(result.current.mediaState.url).toBe('blob:local-1');
    expect(mockFindLocalMediaBlob).toHaveBeenCalledWith(MEDIA_ID, undefined);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(mockFetchUrl).not.toHaveBeenCalled();
  });

  it('falls back to the cloud url when this device has no blob', async () => {
    mockFindLocalMediaBlob.mockResolvedValue(undefined);
    mockFetchUrl.mockResolvedValue('https://s3.example/a.mp3');
    const { result } = renderHook(() => useFetchMediaUrl());

    act(() => result.current.fetchMediaUrl({ id: MEDIA_ID }));

    await waitFor(() =>
      expect(result.current.mediaState.status).toBe(MediaSt.FETCHED)
    );
    expect(result.current.mediaState.url).toBe('https://s3.example/a.mp3');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('releases the local object url when the media is cleared', async () => {
    mockFindLocalMediaBlob.mockResolvedValue(new Blob(['abc']));
    const { result } = renderHook(() => useFetchMediaUrl());

    act(() => result.current.fetchMediaUrl({ id: MEDIA_ID }));
    await waitFor(() =>
      expect(result.current.mediaState.url).toBe('blob:local-1')
    );
    expect(revokeObjectURL).not.toHaveBeenCalled();

    act(() => result.current.fetchMediaUrl({ id: '' }));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-1');
  });

  it('releases the local object url on unmount', async () => {
    mockFindLocalMediaBlob.mockResolvedValue(new Blob(['abc']));
    const { result, unmount } = renderHook(() => useFetchMediaUrl());

    act(() => result.current.fetchMediaUrl({ id: MEDIA_ID }));
    await waitFor(() =>
      expect(result.current.mediaState.url).toBe('blob:local-1')
    );
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-1');
  });

  it('ignores a local result that arrives after the request changed', async () => {
    let resolveFirst: (b: Blob | undefined) => void = () => undefined;
    mockFindLocalMediaBlob
      .mockReturnValueOnce(
        new Promise<Blob | undefined>((r) => {
          resolveFirst = r;
        })
      )
      .mockResolvedValueOnce(undefined);
    mockFetchUrl.mockResolvedValue('https://s3.example/b.mp3');
    const { result } = renderHook(() => useFetchMediaUrl());

    act(() => result.current.fetchMediaUrl({ id: MEDIA_ID }));
    act(() => result.current.fetchMediaUrl({ id: 'other-id' }));
    await waitFor(() =>
      expect(result.current.mediaState.url).toBe('https://s3.example/b.mp3')
    );
    await act(async () => resolveFirst(new Blob(['stale'])));

    expect(result.current.mediaState.url).toBe('https://s3.example/b.mp3');
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
