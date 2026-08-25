import { RecordTransformBuilder } from '@orbit/records';
import { MediaFileD } from '../model';
import { createIntellectualPropertyForMedia } from './createIntellectualPropertyForMedia';

const mockAddRecord = jest.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_t: RecordTransformBuilder, rec: unknown, _user: string, _memory: unknown) => [
    { op: 'addRecord', record: rec },
  ]
);
const mockReplaceRelated = jest.fn(
  (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _t: RecordTransformBuilder,
    rec: unknown,
    relationship: string,
    relatedType: string,
    newId: string
  ) => [{ op: 'replaceRelated', rec, relationship, relatedType, newId }]
);

jest.mock('../model/baseModel', () => ({
  AddRecord: (
    t: RecordTransformBuilder,
    rec: unknown,
    user: string,
    memory: unknown
  ) => mockAddRecord(t, rec, user, memory),
  ReplaceRelatedRecord: (
    t: RecordTransformBuilder,
    rec: unknown,
    relationship: string,
    relatedType: string,
    newId: string
  ) => mockReplaceRelated(t, rec, relationship, relatedType, newId),
}));

jest.mock('./tryFindRecord', () => ({
  findRecord: jest.fn(),
}));
jest.mock('./remoteId', () => ({
  remoteIdGuid: (_table: string, id: string) => id,
}));

import { findRecord } from './tryFindRecord';

describe('createIntellectualPropertyForMedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates IP linked to the mediafile and organization', async () => {
    const update = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(new RecordTransformBuilder());
      }
      return arg;
    });
    const memory = { update } as unknown as import('@orbit/memory').default;

    await createIntellectualPropertyForMedia({
      memory,
      user: 'user-1',
      mediaId: 'media-1',
      rightsHolder: 'Ada',
      organizationId: 'org-1',
      notes: '{"voice":true}',
    });

    expect(mockAddRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'intellectualproperty',
        attributes: expect.objectContaining({
          rightsHolder: 'Ada',
          notes: '{"voice":true}',
        }),
      }),
      'user-1',
      memory
    );
    expect(mockReplaceRelated).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'releaseMediafile',
      'mediafile',
      'media-1'
    );
    expect(mockReplaceRelated).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'organization',
      'organization',
      'org-1'
    );
    expect(update).toHaveBeenCalled();
  });

  it('applies transcription on the release mediafile when provided', async () => {
    const media = {
      id: 'media-1',
      type: 'mediafile',
      attributes: { transcription: '' },
    } as MediaFileD;
    (findRecord as jest.Mock).mockReturnValue(media);
    const applyTranscription = jest.fn();
    const update = jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg(new RecordTransformBuilder());
      }
      return arg;
    });
    const memory = { update } as unknown as import('@orbit/memory').default;

    await createIntellectualPropertyForMedia({
      memory,
      user: 'user-1',
      mediaId: 'media-1',
      rightsHolder: 'Ada',
      organizationId: 'org-1',
      transcription: 'I grant permission',
      applyTranscription,
    });

    expect(applyTranscription).toHaveBeenCalledWith(
      media,
      'I grant permission'
    );
  });
});
