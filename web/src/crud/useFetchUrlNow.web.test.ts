const mockAxiosGet = jest.fn();
const mockDownloadCloudMediaToLocalBlob = jest.fn();
const mockResolveMediafileProject = jest.fn();
const mockIsLocalMediaMissing = jest.fn();
const mockReporter = {};
let mockOpenProject = 'proj-1';

jest.mock('../../api-variable', () => ({ isElectron: false }));
jest.mock('../utils/axios', () => ({
  axiosGet: (...args: unknown[]) => mockAxiosGet(...args),
}));
jest.mock('../utils/downloadCloudMediaToLocalBlob', () => ({
  downloadCloudMediaToLocalBlob: (...args: unknown[]) =>
    mockDownloadCloudMediaToLocalBlob(...args),
}));
jest.mock('../utils/isLocalMediaMissing', () => ({
  isLocalMediaMissing: (...args: unknown[]) => mockIsLocalMediaMissing(...args),
}));
jest.mock('./mediafileProject', () => ({
  resolveMediafileProject: (...args: unknown[]) =>
    mockResolveMediafileProject(...args),
}));
jest.mock('../utils/tryDownload', () => ({ tryDownload: jest.fn() }));
jest.mock('../utils/httpError', () => ({ isUnauthorized: () => false }));
jest.mock('../store/AxiosStatus', () => ({
  errStatus: () => ({ errMsg: '' }),
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'memory') return [{}, jest.fn()];
    if (key === 'errorReporter') return [mockReporter, jest.fn()];
    return [undefined, jest.fn()];
  },
  useGetGlobal: () => (key: string) =>
    key === 'project' ? mockOpenProject : undefined,
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
import { IFetchNowProps, useFetchUrlNow } from './useFetchUrlNow';

describe('useFetchUrlNow (web)', () => {
  const audioUrl = 'https://cdn.example/a.mp3';

  const fetch = async (props: Partial<IFetchNowProps> = {}) => {
    const { result } = renderHook(() => useFetchUrlNow());
    let path = '';
    await act(async () => {
      path = await result.current({
        id: '42',
        cancelled: () => false,
        ...props,
      });
    });
    return path;
  };

  beforeEach(() => {
    mockAxiosGet.mockReset();
    mockDownloadCloudMediaToLocalBlob.mockReset();
    mockResolveMediafileProject.mockReset();
    mockIsLocalMediaMissing.mockReset();
    mockOpenProject = 'proj-1';
    mockAxiosGet.mockResolvedValue({
      data: { attributes: { 'audio-url': audioUrl } },
    });
    mockResolveMediafileProject.mockReturnValue({
      mediafileId: 'mf-guid',
      projectId: 'proj-1',
    });
    mockIsLocalMediaMissing.mockResolvedValue(true);
  });

  it('downloads cloud media into a Local Media Blob and returns the local path', async () => {
    mockDownloadCloudMediaToLocalBlob.mockResolvedValue({
      ok: true,
      path: 'local-media:mf-guid',
    });

    expect(await fetch()).toBe('local-media:mf-guid');
    expect(mockDownloadCloudMediaToLocalBlob).toHaveBeenCalledWith({
      mediafileId: 'mf-guid',
      projectId: 'proj-1',
      audioUrl,
      reporter: mockReporter,
      cancelled: expect.any(Function),
    });
  });

  it('skips the server when this device already has the blob', async () => {
    mockIsLocalMediaMissing.mockResolvedValue(false);

    expect(await fetch()).toBe('local-media:mf-guid');
    expect(mockAxiosGet).not.toHaveBeenCalled();
    expect(mockDownloadCloudMediaToLocalBlob).not.toHaveBeenCalled();
  });

  it('returns the cloud url without storing media from another project', async () => {
    mockOpenProject = 'proj-other';

    expect(await fetch()).toBe(audioUrl);
    expect(mockDownloadCloudMediaToLocalBlob).not.toHaveBeenCalled();
  });

  it('persistOnly skips the server for media it would not store', async () => {
    mockOpenProject = 'proj-other';

    expect(await fetch({ persistOnly: true })).toBe('');
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('returns the cloud url when download is skipped with noDownload', async () => {
    expect(await fetch({ noDownload: true })).toBe(audioUrl);
    expect(mockDownloadCloudMediaToLocalBlob).not.toHaveBeenCalled();
  });

  it('returns the cloud url when the Local Media Blob download fails', async () => {
    mockDownloadCloudMediaToLocalBlob.mockResolvedValue({
      ok: false,
      path: audioUrl,
    });

    expect(await fetch()).toBe(audioUrl);
  });
});
