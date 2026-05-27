import {
  getDraft,
  removeDraft,
  shouldRestoreDraft,
  upsertDraft,
} from './recordingDraftStore';

const STORAGE_KEY = 'recordingDraftsV1';

describe('recordingDraftStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('upserts and retrieves a draft by passageId', () => {
    upsertDraft({
      passageId: 'psg-1',
      mediafileId: 'mf-1',
      relativeMediaPath: 'media/draft.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
      performedBy: 'Speaker',
    });
    const draft = getDraft('psg-1');
    expect(draft?.relativeMediaPath).toBe('media/draft.webm');
    expect(draft?.mediafileId).toBe('mf-1');
    expect(draft?.performedBy).toBe('Speaker');
    expect(draft?.updatedAt).toBeTruthy();
  });

  it('replaces an existing draft for the same passage', () => {
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/old.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
    });
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/new.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
    });
    expect(getDraft('psg-1')?.relativeMediaPath).toBe('media/new.webm');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')).toHaveLength(
      1
    );
  });

  it('removeDraft deletes the entry', () => {
    upsertDraft({
      passageId: 'psg-1',
      relativeMediaPath: 'media/draft.webm',
      mimeType: 'audio/webm',
      filetype: 'webm',
    });
    removeDraft('psg-1');
    expect(getDraft('psg-1')).toBeUndefined();
  });

  describe('shouldRestoreDraft', () => {
    it('returns false when there is no draft', () => {
      expect(shouldRestoreDraft(undefined, '2020-01-01T00:00:00Z')).toBe(false);
    });

    it('returns true when there is no server date', () => {
      expect(
        shouldRestoreDraft(
          {
            passageId: 'psg-1',
            relativeMediaPath: 'media/d.webm',
            mimeType: 'audio/webm',
            filetype: 'webm',
            updatedAt: '2024-01-02T00:00:00Z',
          },
          undefined
        )
      ).toBe(true);
    });

    it('prefers draft when newer than server media', () => {
      expect(
        shouldRestoreDraft(
          {
            passageId: 'psg-1',
            relativeMediaPath: 'media/d.webm',
            mimeType: 'audio/webm',
            filetype: 'webm',
            updatedAt: '2024-06-01T12:00:00Z',
          },
          '2024-01-01T00:00:00Z'
        )
      ).toBe(true);
    });

    it('prefers server when draft is older', () => {
      expect(
        shouldRestoreDraft(
          {
            passageId: 'psg-1',
            relativeMediaPath: 'media/d.webm',
            mimeType: 'audio/webm',
            filetype: 'webm',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          '2024-06-01T12:00:00Z'
        )
      ).toBe(false);
    });
  });
});
