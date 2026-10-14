import { act, renderHook, waitFor } from '@testing-library/react';
import {
  RecordSizeLimitInput,
  deriveSizeStatus,
  useRecordSizeLimit,
} from './useRecordSizeLimit';
import { estimatedOpusBytes } from '../utils/mediaRecordSize';
import { convertToWav } from '../utils/wav';
import { wavBlob } from '../utils/__tests__/wavBlob';

const float32Wav = (size: number) => wavBlob({ size });

/** The WAV the recorder and editor hand over: float32, as audioBufferToWavBlob writes it. */
const editorWav = (channels: 1 | 2, sampleRate: number) =>
  convertToWav(
    new Float32Array(8),
    channels === 2 ? new Float32Array(8) : null,
    { isFloat: true, numChannels: channels, sampleRate }
  );

const base = (
  over: Partial<RecordSizeLimitInput> = {}
): RecordSizeLimitInput => ({
  audioBlob: undefined,
  recording: false,
  waveformDuration: 0,
  saveAsWav: true,
  sizeLimit: 30,
  overTemplate: 'Too big {0}MB/{1}MB',
  warnTemplate: 'Too big warn {0}/{1}',
  afterCompressionTemplate: 'Too big after compression {0}MB/{1}MB',
  compressFailedTemplate: 'Compress error too big',
  onHeaderError: jest.fn(),
  ...over,
});

describe('deriveSizeStatus', () => {
  const status = (over: Partial<Parameters<typeof deriveSizeStatus>[0]> = {}) =>
    deriveSizeStatus({
      recording: false,
      headerPending: false,
      rejected: false,
      estimatedBytes: 0,
      limitBytes: 100,
      warnBytes: 50,
      ...over,
    });

  it('ignores a held rejection and an unread header while recording', () => {
    expect(
      status({ recording: true, rejected: true, headerPending: true })
    ).toBe('ok');
    expect(status({ recording: true, estimatedBytes: 101 })).toBe('over');
  });

  it('ranks rejected, then pending, then the limit boundaries', () => {
    expect(
      status({ rejected: true, headerPending: true, estimatedBytes: 101 })
    ).toBe('rejected');
    expect(status({ headerPending: true, estimatedBytes: 101 })).toBe(
      'pending'
    );
    expect(status({ estimatedBytes: 101 })).toBe('over');
    expect(status({ estimatedBytes: 100 })).toBe('warn');
    expect(status({ estimatedBytes: 51 })).toBe('warn');
    expect(status({ estimatedBytes: 50 })).toBe('ok');
  });
});

describe('useRecordSizeLimit Opus estimate', () => {
  const opus = (over: Partial<RecordSizeLimitInput> = {}) =>
    base({ saveAsWav: false, ...over });

  it('prices a recording the same while live and once the take is handed over', async () => {
    const seconds = 600;
    const props = opus({ recording: true, waveformDuration: seconds });
    const { result, rerender } = renderHook(
      (next: RecordSizeLimitInput) => useRecordSizeLimit(next),
      { initialProps: props }
    );
    const live = result.current.estimatedBytes;
    expect(live).toBe(estimatedOpusBytes(seconds, 1));
    expect(result.current.sizeStatus).toBe('ok');

    // Recording stops; the recorder hands over its mono 48 kHz float32 WAV.
    const take = await editorWav(1, 48_000);
    rerender({ ...props, recording: false, audioBlob: take });
    expect(result.current.sizeStatus).toBe('pending');
    expect(result.current.sizeBlocksSave).toBe(true);

    await waitFor(() => expect(result.current.sizeStatus).toBe('ok'));
    expect(result.current.estimatedBytes).toBe(live);
    expect(result.current.sizeBlocksSave).toBe(false);
  });

  it('prices an edited stereo 44.1 kHz mp3 by its duration at the stereo rate', async () => {
    const seconds = 600;
    const edited = await editorWav(2, 44_100);
    const { result } = renderHook(() =>
      useRecordSizeLimit(opus({ audioBlob: edited, waveformDuration: seconds }))
    );
    await waitFor(() => expect(result.current.sizeStatus).toBe('ok'));
    expect(result.current.estimatedBytes).toBe(estimatedOpusBytes(seconds, 2));
    expect(result.current.estimatedBytes).toBeCloseTo(
      estimatedOpusBytes(seconds, 1) * 1.5
    );
  });

  it('warns near the limit and blocks over it while still recording', () => {
    // 30 MB at 64 kbps plus 15% headroom is about 54 minutes.
    const { result, rerender } = renderHook(
      (next: RecordSizeLimitInput) => useRecordSizeLimit(next),
      { initialProps: opus({ recording: true, waveformDuration: 3000 }) }
    );
    expect(result.current.sizeStatus).toBe('ok');

    rerender(opus({ recording: true, waveformDuration: 3206 }));
    expect(result.current.sizeStatus).toBe('warn');
    expect(result.current.sizeBlocksSave).toBe(false);

    rerender(opus({ recording: true, waveformDuration: 3300 }));
    expect(result.current.sizeStatus).toBe('over');
    expect(result.current.sizeBlocksSave).toBe(true);
    expect(result.current.sizeWarning).toBe('Too big 30.36MB/30MB');
  });
});

describe('useRecordSizeLimit', () => {
  it('blocks a file over the limit and warns inside the last megabyte', async () => {
    const over = renderHook(
      (props: RecordSizeLimitInput) => useRecordSizeLimit(props),
      { initialProps: base({ audioBlob: float32Wav(2_000_000), sizeLimit: 1 }) }
    );
    await waitFor(() => expect(over.result.current.sizeStatus).toBe('over'));
    expect(over.result.current.sizeBlocksSave).toBe(true);
    expect(over.result.current.sizeWarning).toBe('Too big 2.00MB/1MB');

    const near = renderHook(
      (props: RecordSizeLimitInput) => useRecordSizeLimit(props),
      {
        initialProps: base({
          audioBlob: float32Wav(1_500_000),
          sizeLimit: 2,
        }),
      }
    );
    await waitFor(() => expect(near.result.current.sizeStatus).toBe('warn'));
    expect(near.result.current.sizeBlocksSave).toBe(false);
    expect(near.result.current.sizeWarning).toBe('Too big warn 1.50/2');
  });

  it('drops a rejection when a different file arrives', async () => {
    const blob = float32Wav(1000);
    const props = base({ audioBlob: blob });
    const { result, rerender } = renderHook(
      (next: RecordSizeLimitInput) => useRecordSizeLimit(next),
      { initialProps: props }
    );
    await waitFor(() => expect(result.current.sizeStatus).toBe('ok'));

    act(() =>
      result.current.rejectTake(blob, {
        kind: 'afterCompression',
        bytes: 2_000_000,
      })
    );
    expect(result.current.sizeStatus).toBe('rejected');
    expect(result.current.sizeWarning).toBe(
      'Too big after compression 2.00MB/30MB'
    );
    expect(result.current.sizeBlocksSave).toBe(true);

    rerender({ ...props, audioBlob: undefined });
    expect(result.current.sizeStatus).toBe('rejected');

    rerender({ ...props, audioBlob: float32Wav(1000) });
    rerender({ ...props, audioBlob: undefined });
    expect(result.current.sizeStatus).not.toBe('rejected');
    expect(result.current.sizeWarning).toBe('');
  });

  it('formats a stored rejection in the current language', async () => {
    const blob = float32Wav(1000);
    const props = base({
      audioBlob: blob,
      afterCompressionTemplate: 'Too big after compression {0}MB/{1}MB',
    });
    const { result, rerender } = renderHook(
      (next: RecordSizeLimitInput) => useRecordSizeLimit(next),
      { initialProps: props }
    );
    await waitFor(() => expect(result.current.sizeStatus).toBe('ok'));

    act(() =>
      result.current.rejectTake(blob, {
        kind: 'afterCompression',
        bytes: 2_000_000,
      })
    );
    expect(result.current.sizeWarning).toBe(
      'Too big after compression 2.00MB/30MB'
    );

    rerender({
      ...props,
      afterCompressionTemplate: 'Trop gros {0}MB/{1}MB',
      overTemplate: 'Trop gros fichier {0}MB/{1}MB',
      compressFailedTemplate: 'Echec compression',
    });
    expect(result.current.sizeWarning).toBe('Trop gros 2.00MB/30MB');
    expect(result.current.rejectionMessage).toBe('Trop gros 2.00MB/30MB');

    act(() =>
      result.current.rejectTake(blob, {
        kind: 'compressFailed',
        bytes: 2_000_000,
        detail: 'encode failed',
      })
    );
    rerender({
      ...props,
      afterCompressionTemplate: 'Trop gros {0}MB/{1}MB',
      overTemplate: 'Trop gros fichier {0}MB/{1}MB',
      compressFailedTemplate: 'Echec',
    });
    expect(result.current.sizeWarning).toBe(
      'Echec Trop gros fichier 2.00MB/30MB encode failed'
    );
  });

  it('reports a header read failure and still prices the file', async () => {
    const onHeaderError = jest.fn();
    const blob = float32Wav(1000);
    const headerError = new Error('header failed');
    Object.defineProperty(blob, 'slice', {
      value: () => ({
        arrayBuffer: () => Promise.reject(headerError),
      }),
    });
    const { result } = renderHook(() =>
      useRecordSizeLimit(base({ audioBlob: blob, onHeaderError }))
    );

    await waitFor(() =>
      expect(onHeaderError).toHaveBeenCalledWith(headerError)
    );
    await waitFor(() => expect(result.current.sizeStatus).toBe('ok'));
    expect(result.current.sizeBlocksSave).toBe(false);
  });
});
