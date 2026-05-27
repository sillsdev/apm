import { restoreRecordingDraft } from './restoreRecordingDraft';
import { upsertDraft } from './recordingDraftStore';

jest.mock('./tryFindRecord', () => ({
  findRecord: jest.fn(),
}));

jest.mock('../utils/dataPath', () => ({
  PathType: { MEDIA: 'media' },
  dataPath: jest.fn(async (relPath: string) => `/home/media/${relPath}`),
}));

jest.mock('../utils/loadBlob', () => ({
  loadBlobAsync: jest.fn(
    async () => new Blob(['restored'], { type: 'audio/webm' })
  ),
}));

jest.mock('../../api-variable', () => ({
  isElectron: true,
}));

const mockIpc = {
  isWindows: jest.fn(async () => false),
};
(window as { api?: typeof mockIpc }).api = mockIpc;

const { findRecord } = require('./tryFindRecord') as {
  findRecord: jest.Mock;
};

describe('restoreRecordingDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    findRecord.mockReset();
  });

  it('returns null when passageId is missing', async () => {
    await expect(
      restoreRecordingDraft(undefined, 'mf-1', {} as never)
    ).resolves.toBeNull();
  });

  it('restores when draft is newer than server media', async () => {
    upsertDraft({
      passageId: 'psg-1',
      mediafileId: 'mf-1',
      relativeMediaPath: 'media/draft.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
      updatedAt: '2025-01-02T00:00:00Z',
    });
    findRecord.mockReturnValue({
      attributes: { dateUpdated: '2024-01-01T00:00:00Z' },
    });

    const result = await restoreRecordingDraft('psg-1', 'mf-1', {} as never);
    expect(result?.blob).toBeInstanceOf(Blob);
    expect(result?.draft.passageId).toBe('psg-1');
  });

  it('returns null when server media is newer than draft', async () => {
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/draft.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    findRecord.mockReturnValue({
      attributes: { dateUpdated: '2025-06-01T00:00:00Z' },
    });

    await expect(
      restoreRecordingDraft('psg-1', 'mf-1', {} as never)
    ).resolves.toBeNull();
  });
});
