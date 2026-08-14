import { MediaFileD, PassageD, SharedResourceD } from '../model';
import {
  filterMediaForPassage,
  mediaPassageIdForTranscribe,
} from './mediaPassageIdForTranscribe';

const createMockMemory = (records: { type: string; id: string }[]) =>
  ({
    cache: {
      query: (qOrBuilder: unknown) => {
        const spec =
          typeof qOrBuilder === 'function'
            ? qOrBuilder({
                findRecord: (identity: { type: string; id: string }) =>
                  identity,
              })
            : qOrBuilder;
        const identity = spec as { type: string; id: string };
        return records.find(
          (r) => r.type === identity.type && r.id === identity.id
        );
      },
    },
  }) as any;

describe('mediaPassageIdForTranscribe (TT-5873)', () => {
  it('returns the owned note passage id when there is no shared resource', () => {
    const passage = { id: 'note-1' } as PassageD;
    expect(mediaPassageIdForTranscribe(passage)).toBe('note-1');
  });

  it('returns the source passage id for a linked existing note', () => {
    const source = {
      type: 'sharedresource',
      id: 'sr-1',
      relationships: {
        passage: { data: { type: 'passage', id: 'source-pas' } },
      },
    } as SharedResourceD & { type: string };
    const linking = {
      id: 'link-pas',
      relationships: {
        sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
      },
    } as PassageD;
    const memory = createMockMemory([source]);
    expect(mediaPassageIdForTranscribe(linking, memory)).toBe('source-pas');
  });
});

describe('filterMediaForPassage (TT-5873)', () => {
  it('includes PBT media attached to the source passage of a linked note', () => {
    const source = {
      type: 'sharedresource',
      id: 'sr-1',
      relationships: {
        passage: { data: { type: 'passage', id: 'source-pas' } },
      },
    } as SharedResourceD & { type: string };
    const linking = {
      id: 'link-pas',
      relationships: {
        sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
      },
    } as PassageD;
    const media = [
      {
        id: 'pbt-1',
        relationships: {
          passage: { data: { type: 'passage', id: 'source-pas' } },
        },
      },
      {
        id: 'other',
        relationships: {
          passage: { data: { type: 'passage', id: 'unrelated' } },
        },
      },
    ] as MediaFileD[];
    const memory = createMockMemory([source]);
    const passageId = mediaPassageIdForTranscribe(linking, memory);
    expect(filterMediaForPassage(media, passageId).map((m) => m.id)).toEqual([
      'pbt-1',
    ]);
  });
});
