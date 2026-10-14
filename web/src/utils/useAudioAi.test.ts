import { jest, describe, it, expect } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

const mockGetGlobal = jest.fn<(key: string) => boolean>(() => true);

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
  useGetGlobal: () => mockGetGlobal,
}));

jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext(null) };
});

jest.mock('./axios', () => ({
  axiosDelete: jest.fn(),
  axiosGet: jest.fn(),
  axiosPostFile: jest.fn(),
  axiosSendSignedUrl: jest.fn(),
}));

jest.mock('./logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  Severity: { error: 'error', info: 'info' },
}));

jest.mock('../store/upload/actions', () => ({
  uploadFile: jest.fn(),
}));

jest.mock('../store/upload/uploadRetry', () => ({
  runWithUploadRetries: (work: () => Promise<void>) => work(),
}));

jest.mock('./loadBlob', () => ({
  loadBlobAsync: jest.fn(),
}));

import { AudioAiFunc, useAudioAi } from './useAudioAi';
import { AudioAiError, AudioAiErrorCode } from './audioAiError';
import { axiosGet } from './axios';

describe('useAudioAi', () => {
  it('reports an error when the AI request is skipped because the app is offline', async () => {
    mockGetGlobal.mockImplementation(() => true);
    const cb = jest.fn();
    const { result } = renderHook(() => useAudioAi());

    await act(async () => {
      await result.current.requestAudioAi({
        func: AudioAiFunc.noiseRemoval,
        cancelRef: { current: false },
        file: new File(['x'], 'a.wav', { type: 'audio/wav' }),
        cb,
      });
    });

    expect(cb).toHaveBeenCalledTimes(1);
    const error = cb.mock.calls[0][0];
    expect(error).toBeInstanceOf(AudioAiError);
    expect((error as AudioAiError).code).toBe(AudioAiErrorCode.offline);
  });

  it('reports an error when the AI request is skipped because there is no token', async () => {
    mockGetGlobal.mockImplementation((key: string) => key === 'connected');
    const cb = jest.fn();
    const { result } = renderHook(() => useAudioAi());

    await act(async () => {
      await result.current.requestAudioAi({
        func: AudioAiFunc.noiseRemoval,
        cancelRef: { current: false },
        file: new File(['x'], 'a.wav', { type: 'audio/wav' }),
        cb,
      });
    });

    expect(axiosGet).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
    const error = cb.mock.calls[0][0];
    expect(error).toBeInstanceOf(AudioAiError);
    expect((error as AudioAiError).code).toBe(AudioAiErrorCode.noToken);
  });
});
