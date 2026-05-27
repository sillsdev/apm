jest.mock('../utils/infoMsg', () => ({
  infoMsg: (e: Error, info: string) => ({ ...e, name: info + e.name }),
}));

jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: jest.fn(),
}));

import {
  deleteDraftFileIfPresent,
  purgeRecordingDraft,
  resolveDraftAbsolutePath,
} from './recordingDraftFiles';
import { getDraft, upsertDraft } from './recordingDraftStore';

const mockExists = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../api-variable', () => ({
  isElectron: true,
}));

jest.mock('../utils/dataPath', () => ({
  PathType: { MEDIA: 'media' },
  dataPath: jest.fn(async (relPath: string) => `/home/offline/${relPath}`),
}));

(window as { api?: { exists: typeof mockExists; delete: typeof mockDelete } })
  .api = {
  exists: mockExists,
  delete: mockDelete,
};

describe('recordingDraftFiles', () => {
  beforeEach(() => {
    localStorage.clear();
    mockExists.mockReset();
    mockDelete.mockReset();
    mockExists.mockResolvedValue(true);
    mockDelete.mockResolvedValue(undefined);
  });

  it('resolveDraftAbsolutePath returns local path for media relative paths', async () => {
    await expect(
      resolveDraftAbsolutePath('media/draft.webm')
    ).resolves.toBe('/home/offline/media/draft.webm');
  });

  it('resolveDraftAbsolutePath returns undefined for http paths', async () => {
    await expect(
      resolveDraftAbsolutePath('https://example.com/a.webm')
    ).resolves.toBeUndefined();
  });

  it('deleteDraftFileIfPresent deletes when file exists', async () => {
    await deleteDraftFileIfPresent('media/draft.webm');
    expect(mockExists).toHaveBeenCalledWith('/home/offline/media/draft.webm');
    expect(mockDelete).toHaveBeenCalledWith('/home/offline/media/draft.webm');
  });

  it('deleteDraftFileIfPresent skips delete when file does not exist', async () => {
    mockExists.mockResolvedValue(false);
    await deleteDraftFileIfPresent('media/missing.webm');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('purgeRecordingDraft deletes file and removes metadata', async () => {
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/draft.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
    });
    await purgeRecordingDraft('psg-1');
    expect(mockDelete).toHaveBeenCalledWith('/home/offline/media/draft.webm');
    expect(getDraft('psg-1')).toBeUndefined();
  });
});
