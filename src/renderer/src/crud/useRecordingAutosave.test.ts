/* eslint-disable @typescript-eslint/no-require-imports */
import { act, renderHook } from '@testing-library/react';
import { getDraft, upsertDraft } from './recordingDraftStore';

jest.mock('../utils/infoMsg', () => ({
  infoMsg: (e: Error, info: string) => ({ ...e, name: info + e.name }),
}));

jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: jest.fn(),
}));

const mockWriteFileLocal = jest.fn();
const mockDeleteDraftFileIfPresent = jest.fn();
const mockPurgeRecordingDraft = jest.fn();

jest.mock('../store/upload/actions', () => ({
  writeFileLocal: (...args: unknown[]) => mockWriteFileLocal(...args),
}));

jest.mock('./recordingDraftFiles', () => ({
  deleteDraftFileIfPresent: (...args: unknown[]) =>
    mockDeleteDraftFileIfPresent(...args),
  purgeRecordingDraft: (...args: unknown[]) => mockPurgeRecordingDraft(...args),
}));

const mockShowMessage = jest.fn();
jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined],
}));

import {
  RECORDING_AUTOSAVE_DEBOUNCE_MS,
  useRecordingAutosave,
} from './useRecordingAutosave';

describe('useRecordingAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    mockWriteFileLocal.mockReset();
    mockShowMessage.mockReset();
    mockDeleteDraftFileIfPresent.mockReset();
    mockPurgeRecordingDraft.mockReset();
    mockDeleteDraftFileIfPresent.mockResolvedValue(undefined);
    mockPurgeRecordingDraft.mockResolvedValue(undefined);
    mockWriteFileLocal.mockResolvedValue({
      relativeMediaPath: 'media/autosave.webm',
      absolutePath: '/tmp/media/autosave.webm',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const baseProps = () => ({
    passageId: 'psg-1',
    mediaId: 'mf-1',
    audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
    performedBy: 'Ann',
    mimeType: 'audio/webm',
    filetype: 'webm',
    defaultFilename: 'GEN001',
    blobReady: true,
    filechanged: true,
    recording: false,
    converting: false,
    uploading: false,
    tooBig: false,
    mediaSaveInProgress: false,
    setStatusText: jest.fn(),
    autosavedLocallyText: 'Saved locally',
  });

  it('debounces writeFileLocal and upserts draft when guards pass', async () => {
    renderHook(() => useRecordingAutosave(baseProps()));

    await act(async () => {
      jest.advanceTimersByTime(RECORDING_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(mockWriteFileLocal).toHaveBeenCalledTimes(1);
    const draft = getDraft('psg-1');
    expect(draft?.relativeMediaPath).toBe('media/autosave.webm');
    expect(draft?.performedBy).toBe('Ann');
    expect(draft?.mediafileId).toBe('mf-1');
  });

  it('does not autosave while recording', async () => {
    renderHook(() =>
      useRecordingAutosave({ ...baseProps(), recording: true })
    );

    await act(async () => {
      jest.advanceTimersByTime(RECORDING_AUTOSAVE_DEBOUNCE_MS + 100);
    });

    expect(mockWriteFileLocal).not.toHaveBeenCalled();
  });

  it('deletes previous draft file before a subsequent autosave', async () => {
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/old.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
    });

    const { rerender } = renderHook((props) => useRecordingAutosave(props), {
      initialProps: baseProps(),
    });

    await act(async () => {
      jest.advanceTimersByTime(RECORDING_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(mockDeleteDraftFileIfPresent).toHaveBeenCalledWith(
      'media/old.webm',
      undefined
    );
    expect(mockWriteFileLocal).toHaveBeenCalledTimes(1);

    mockDeleteDraftFileIfPresent.mockClear();
    mockWriteFileLocal.mockClear();

    rerender({
      ...baseProps(),
      audioBlob: new Blob(['updated'], { type: 'audio/webm' }),
    });

    await act(async () => {
      jest.advanceTimersByTime(RECORDING_AUTOSAVE_DEBOUNCE_MS);
    });

    expect(mockDeleteDraftFileIfPresent).toHaveBeenCalledWith(
      'media/autosave.webm',
      undefined
    );
    expect(mockWriteFileLocal).toHaveBeenCalledTimes(1);
  });

  it('clearDraft purges stored draft', async () => {
    const { result } = renderHook(() => useRecordingAutosave(baseProps()));

    await act(async () => {
      await result.current.clearDraft();
    });

    expect(mockPurgeRecordingDraft).toHaveBeenCalledWith('psg-1', undefined);
  });
});
