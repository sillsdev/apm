/* eslint-disable @typescript-eslint/no-require-imports */
const mockDataPath = jest.fn();
const mockRemoteId = jest.fn(() => '9');
const mockExists = jest.fn();
const mockIsWindows = jest.fn();

jest.mock('../../api-variable', () => ({
  isElectron: true,
}));

jest.mock('../utils/dataPath', () => ({
  dataPath: mockDataPath,
  PathType: { AVATARS: 'avatars' },
}));

jest.mock('./remoteId', () => ({
  remoteId: mockRemoteId,
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [{}, jest.fn()],
}));

describe('useAvatarSource', () => {
  const rec = {
    id: '',
    type: 'user',
    attributes: { avatarUrl: null, name: '', familyName: '' },
  };

  function load() {
    jest.resetModules();
    (window as unknown as { api: unknown }).api = {
      exists: mockExists,
      isWindows: mockIsWindows,
    };
    const { renderHook, waitFor } = require('@testing-library/react/pure');
    const { useAvatarSource } = require('./useAvatarSource');
    return { renderHook, waitFor, useAvatarSource };
  }

  beforeEach(() => {
    mockDataPath.mockReset();
    mockRemoteId.mockReset().mockReturnValue('9');
    mockExists.mockReset();
    mockIsWindows.mockReset().mockResolvedValue(true);
  });

  it('does not use the offline data directory as an avatar src', async () => {
    mockDataPath.mockResolvedValue('C:/Users/shent/transcriber');
    mockExists.mockResolvedValue(true);
    const { renderHook, waitFor, useAvatarSource } = load();
    const { result } = renderHook(() => useAvatarSource('', rec));
    await waitFor(() => expect(result.current).toBe(''));
    expect(mockExists).not.toHaveBeenCalled();
  });

  it('uses file:// for a local png that exists', async () => {
    mockDataPath.mockResolvedValue('C:/Users/shent/transcriber/9.png');
    mockExists.mockResolvedValue(true);
    const { renderHook, waitFor, useAvatarSource } = load();
    const { result } = renderHook(() =>
      useAvatarSource('Smith', { ...rec, id: 'u1' })
    );
    await waitFor(() => expect(result.current).toMatch(/^file:\/\/.*9\.png$/));
  });
});
