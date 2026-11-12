import { act, renderHook, waitFor } from '@testing-library/react';
import { convertToFormat, useMediaUpload } from '../crud';
import { AlertSeverity } from '../hoc/useSnackBar';
import { logError } from '../utils';
import { RecordSaveInput, useRecordSave } from './useRecordSave';

jest.mock('../crud', () => ({
  convertToFormat: jest.fn(),
  useMediaUpload: jest.fn(),
}));

jest.mock('../utils', () => ({
  infoMsg: (error: Error, info: string) =>
    Object.assign(error, { name: info + error.name }),
  logError: jest.fn(),
  Severity: { error: 1 },
}));

const mockConvert = convertToFormat as jest.Mock;
const mockUseMediaUpload = useMediaUpload as jest.Mock;
const mockLogError = logError as jest.Mock;

const bytes = (n: number) => new Blob([new Uint8Array(n)]);

describe('useRecordSave', () => {
  const audioBlobRef: { current: Blob | undefined } = { current: undefined };
  let requested = false;
  let toolsChanged = 0;
  const saveCompleted = jest.fn();
  const onSaveRejected = jest.fn();
  const showMessage = jest.fn();
  const setStatusText = jest.fn();
  const uploadMedia = jest.fn();
  const rejectTake = jest.fn();
  const onReady = jest.fn();
  const reset = jest.fn();

  const input = (over: Partial<RecordSaveInput> = {}): RecordSaveInput => {
    const audioBlob = 'audioBlob' in over ? over.audioBlob : bytes(80);
    if (!over.audioBlobRef) audioBlobRef.current = audioBlob;
    const changed: RecordSaveInput['toolsChanged'] = {
      tick: {
        startSave: false,
        clearChanged: false,
        saveError: String(toolsChanged),
      },
    };
    return {
      toolId: 'record-tool',
      waveformDuration: 12,
      mimeType: 'audio/ogg;codecs=opus',
      filetype: 'ogg',
      sizeStatus: 'ok',
      limitBytes: 1_000_000,
      rejectionMessage: undefined,
      defaultFilename: 'take',
      mediaError: 'Media error',
      noSaveWoMedia: 'No media',
      compressing: 'Compressing...',
      compressError: 'Compress error',
      saving: 'Saving...',
      reporter: 'test',
      onReady,
      onSaveRejected,
      onUploaded: jest.fn(async () => undefined),
      upload: { artifactId: null, passageId: undefined },
      saveRequested: () => requested,
      saveCompleted,
      clearRequested: () => false,
      setStatusText,
      showMessage,
      rejectTake,
      reset,
      ...over,
      audioBlob,
      audioBlobRef: over.audioBlobRef ?? audioBlobRef,
      toolsChanged: over.toolsChanged ?? changed,
    };
  };

  beforeEach(() => {
    requested = false;
    toolsChanged = 0;
    audioBlobRef.current = undefined;
    jest.clearAllMocks();
    mockUseMediaUpload.mockImplementation(() => uploadMedia);
    mockConvert.mockResolvedValue(bytes(40));
    uploadMedia.mockResolvedValue(true);
    rejectTake.mockReturnValue('too big');
  });

  const start = () => {
    const view = renderHook((props: RecordSaveInput) => useRecordSave(props), {
      initialProps: input(),
    });
    const ask = async (over: Partial<RecordSaveInput> = {}) => {
      requested = true;
      toolsChanged += 1;
      await act(async () => {
        view.rerender(input(over));
      });
    };
    return { ...view, ask };
  };

  it('shows Saving in the language of the click', async () => {
    const { ask } = start();
    await ask({
      saving: 'Enregistrement...',
      mimeType: 'audio/wav',
      filetype: 'wav',
    });
    await waitFor(() =>
      expect(setStatusText).toHaveBeenCalledWith('Enregistrement...')
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });

  it('calls onReady after a compressed save', async () => {
    const { ask } = start();
    await ask();
    await waitFor(() => expect(uploadMedia).toHaveBeenCalled());
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('reports a media error when the take changes before upload', async () => {
    let resolveConvert: (blob: Blob) => void = () => undefined;
    mockConvert.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConvert = resolve;
        })
    );
    const { ask } = start();
    await ask();
    audioBlobRef.current = bytes(8);
    await act(async () => {
      resolveConvert(bytes(8));
    });
    await waitFor(() => expect(onSaveRejected).toHaveBeenCalledTimes(1));
    expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'Media error');
    expect(onSaveRejected.mock.invocationCallOrder[0]).toBeLessThan(
      saveCompleted.mock.invocationCallOrder[0]
    );
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(rejectTake).not.toHaveBeenCalled();
  });

  it('uploads WAV when compression fails under the limit', async () => {
    mockConvert.mockRejectedValue(new Error('encoder died'));
    const { ask } = start();
    await ask();
    await waitFor(() => expect(uploadMedia).toHaveBeenCalled());
    expect(showMessage).toHaveBeenCalledWith('Compress error  encoder died');
    expect(rejectTake).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
    const file = uploadMedia.mock.calls[0][0][0] as File;
    expect(file.name).toBe('take.wav');
    expect(file.type).toBe('audio/wav');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('rejects a compression failure that is over the limit', async () => {
    mockConvert.mockRejectedValue(new Error('encoder died'));
    const big = bytes(2000);
    const { ask } = start();
    await ask({ audioBlob: big, limitBytes: 1000 });
    await waitFor(() => expect(rejectTake).toHaveBeenCalled());
    expect(rejectTake).toHaveBeenCalledWith(big, {
      kind: 'compressFailed',
      bytes: 2000,
      detail: 'encoder died',
    });
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'too big');
    expect(onSaveRejected.mock.invocationCallOrder[0]).toBeLessThan(
      saveCompleted.mock.invocationCallOrder[0]
    );
  });

  it('rejects a converted file that is over the limit', async () => {
    const converted = bytes(5000);
    mockConvert.mockResolvedValue(converted);
    const { ask } = start();
    await ask({ limitBytes: 1000 });
    await waitFor(() => expect(rejectTake).toHaveBeenCalled());
    expect(rejectTake).toHaveBeenCalledWith(expect.any(Blob), {
      kind: 'afterCompression',
      bytes: 5000,
    });
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'too big');
  });

  it('reports a rejected take again without converting', async () => {
    const { ask } = start();
    await ask({
      sizeStatus: 'rejected',
      rejectionMessage: 'held rejection',
    });
    expect(mockConvert).not.toHaveBeenCalled();
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(
      'held rejection',
      AlertSeverity.Error
    );
    expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'held rejection');
    expect(onSaveRejected.mock.invocationCallOrder[0]).toBeLessThan(
      saveCompleted.mock.invocationCallOrder[0]
    );
  });

  it('reports an empty save', async () => {
    const { ask } = start();
    await ask({ audioBlob: undefined, waveformDuration: 0 });
    expect(onSaveRejected).toHaveBeenCalledTimes(1);
    expect(showMessage).toHaveBeenCalledWith('No media');
    expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'No media');
    expect(setStatusText).toHaveBeenCalledWith('No media');
    expect(uploadMedia).not.toHaveBeenCalled();
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it('uses Save failed when the upload rejection has no message', async () => {
    uploadMedia.mockRejectedValue(undefined);
    const { ask } = start();
    await ask({ mimeType: 'audio/wav', filetype: 'wav' });
    await waitFor(() =>
      expect(saveCompleted).toHaveBeenCalledWith('record-tool', 'Save failed')
    );
    expect(onSaveRejected.mock.invocationCallOrder[0]).toBeLessThan(
      saveCompleted.mock.invocationCallOrder[0]
    );
  });
});
