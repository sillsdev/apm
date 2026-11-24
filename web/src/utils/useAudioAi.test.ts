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
import { axiosDelete, axiosGet, axiosSendSignedUrl } from './axios';
import { uploadFile } from '../store/upload/actions';
import { loadBlobAsync } from './loadBlob';
import { TokenContext } from '../context/TokenProvider';
import React from 'react';

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

  // TT-7791: Cancel is clickable while the processed WAV downloads. A result
  // that finishes downloading after Cancel must not replace the recording.
  it('reports cancel, not the result, when Cancel lands while the result downloads', async () => {
    jest.useFakeTimers();
    try {
      mockGetGlobal.mockImplementation((key: string) => key === 'connected');
      (axiosGet as jest.Mock).mockImplementation((url: unknown) =>
        Promise.resolve(
          String(url).startsWith('S3Files/put')
            ? 'https://s3/put-url'
            : { message: 'https://s3/result.wav?sig' }
        )
      );
      (uploadFile as jest.Mock).mockImplementation(() =>
        Promise.resolve({ statusNum: 0 })
      );
      (axiosSendSignedUrl as jest.Mock).mockImplementation(() =>
        Promise.resolve({ status: 200, data: 'task1' })
      );
      let finishDownload: (blob: Blob) => void = () => undefined;
      (loadBlobAsync as jest.Mock).mockImplementation(
        () =>
          new Promise<Blob>((resolve) => {
            finishDownload = resolve;
          })
      );
      (axiosDelete as jest.Mock).mockImplementation(() => Promise.resolve());
      const cancelRef = { current: false };
      const cb = jest.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          TokenContext.Provider,
          {
            value: {
              state: { accessToken: 't' },
            } as unknown as React.ContextType<typeof TokenContext>,
          },
          children
        );
      const { result } = renderHook(() => useAudioAi(), { wrapper });

      await act(async () => {
        await result.current.requestAudioAi({
          func: AudioAiFunc.noiseRemoval,
          cancelRef,
          file: new File(['x'], 'a.wav', { type: 'audio/wav' }),
          cb,
        });
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10000);
      });
      expect(loadBlobAsync).toHaveBeenCalled();

      cancelRef.current = true;
      await act(async () => {
        finishDownload(new Blob([new Uint8Array([1, 2, 3])]));
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(cb.mock.calls.some(([arg]) => arg instanceof File)).toBe(false);
      expect(cb).toHaveBeenCalledTimes(1);
      const error = cb.mock.calls[0][0];
      expect(error).toBeInstanceOf(AudioAiError);
      expect((error as AudioAiError).code).toBe(AudioAiErrorCode.canceled);
    } finally {
      jest.useRealTimers();
    }
  });
});
