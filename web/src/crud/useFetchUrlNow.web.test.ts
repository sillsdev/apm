const mockAxiosGet = jest.fn();
const mockDownloadCloudMediaToLocalBlob = jest.fn();
const mockGetMediaProjRec = jest.fn();
const mockRemoteIdGuid = jest.fn();
const mockMemory = {
  cache: {
    query: jest.fn(),
  },
  keyMap: {},
};

jest.mock('../../api-variable', () => ({ isElectron: false }));
jest.mock('../utils/axios', () => ({
  axiosGet: (...args: unknown[]) => mockAxiosGet(...args),
}));
jest.mock('../utils/downloadCloudMediaToLocalBlob', () => ({
  downloadCloudMediaToLocalBlob: (...args: unknown[]) =>
    mockDownloadCloudMediaToLocalBlob(...args),
  localMediaPath: (id: string) => `local-media:${id}`,
}));
jest.mock('../utils/tryDownload', () => ({ tryDownload: jest.fn() }));
jest.mock('../utils/httpError', () => ({ isUnauthorized: () => false }));
jest.mock('../store/AxiosStatus', () => ({
  errStatus: () => ({ errMsg: '' }),
}));
jest.mock('../crud/media', () => ({
  getMediaProjRec: (...args: unknown[]) => mockGetMediaProjRec(...args),
}));
jest.mock('../crud/remoteId', () => ({
  remoteIdGuid: (...args: unknown[]) => mockRemoteIdGuid(...args),
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'memory') return [mockMemory, jest.fn()];
    return [undefined, jest.fn()];
  },
}));
jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: React.createContext({
      state: { accessToken: 'tok' },
    }),
  };
});
jest.mock('react-redux', () => ({
  useSelector: () => ({ expiredToken: 'expired' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../selector', () => ({ sharedSelector: jest.fn() }));

import { renderHook, act } from '@testing-library/react';
import { useFetchUrlNow } from './useFetchUrlNow';

describe('useFetchUrlNow (web)', () => {
  const mediaRec = { id: 'mf-guid', type: 'mediafile' };
  const audioUrl = 'https://cdn.example/a.mp3';

  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockDownloadCloudMediaToLocalBlob.mockReset();
    mockGetMediaProjRec.mockReset();
    mockRemoteIdGuid.mockReset();
    mockMemory.cache.query.mockReset();
    mockAxiosGet.mockResolvedValue({
      data: { attributes: { 'audio-url': audioUrl } },
    });
    mockRemoteIdGuid.mockReturnValue('mf-guid');
    mockMemory.cache.query.mockReturnValue(mediaRec);
    mockGetMediaProjRec.mockReturnValue({ id: 'proj-1' });
  });

  it('downloads cloud media into a Local Media Blob and returns the local path', async () => {
    mockDownloadCloudMediaToLocalBlob.mockResolvedValue({
      ok: true,
      path: 'local-media:mf-guid',
    });
    const { result } = renderHook(() => useFetchUrlNow());

    let path = '';
    await act(async () => {
      path = await result.current({
        id: '42',
        cancelled: () => false,
      });
    });

    expect(path).toBe('local-media:mf-guid');
    expect(mockDownloadCloudMediaToLocalBlob).toHaveBeenCalledWith({
      mediafileId: 'mf-guid',
      projectId: 'proj-1',
      audioUrl,
      cancelled: expect.any(Function),
    });
  });

  it('returns the cloud url when download is skipped with noDownload', async () => {
    const { result } = renderHook(() => useFetchUrlNow());

    let path = '';
    await act(async () => {
      path = await result.current({
        id: '42',
        cancelled: () => false,
        noDownload: true,
      });
    });

    expect(path).toBe(audioUrl);
    expect(mockDownloadCloudMediaToLocalBlob).not.toHaveBeenCalled();
  });

  it('returns the cloud url when the Local Media Blob download fails', async () => {
    mockDownloadCloudMediaToLocalBlob.mockResolvedValue({
      ok: false,
      path: audioUrl,
    });
    const { result } = renderHook(() => useFetchUrlNow());

    let path = '';
    await act(async () => {
      path = await result.current({
        id: '42',
        cancelled: () => false,
      });
    });

    expect(path).toBe(audioUrl);
  });
});
