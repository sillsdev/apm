import { MediaFileD, PassageD, SharedResourceD } from '../model';
import { VernacularTag } from './useArtifactType';
import {
  filterMediaForPassage,
  mediaPassageIdForTranscribe,
  transcribeMediaForPassage,
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

function media(opts: {
  id: string;
  passage: string;
  plan: string;
  artifactType?: string | null;
  sourceMedia?: string;
  version?: number;
  transcription?: string;
}): MediaFileD {
  return {
    id: opts.id,
    type: 'mediafile',
    attributes: {
      versionNumber: opts.version ?? 1,
      transcription: opts.transcription,
    },
    relationships: {
      passage: { data: { type: 'passage', id: opts.passage } },
      plan: { data: { type: 'plan', id: opts.plan } },
      artifactType: {
        data:
          opts.artifactType == null
            ? null
            : { type: 'artifacttype', id: opts.artifactType },
      },
      ...(opts.sourceMedia
        ? {
            sourceMedia: {
              data: { type: 'mediafile', id: opts.sourceMedia },
            },
          }
        : {}),
    },
  } as MediaFileD;
}

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
    const mediaFiles = [
      media({
        id: 'pbt-1',
        passage: 'source-pas',
        plan: 'source-plan',
        artifactType: 'pbt',
      }),
      media({
        id: 'other',
        passage: 'unrelated',
        plan: 'source-plan',
        artifactType: 'pbt',
      }),
    ];
    const memory = createMockMemory([source]);
    const passageId = mediaPassageIdForTranscribe(linking, memory);
    expect(filterMediaForPassage(mediaFiles, passageId).map((m) => m.id)).toEqual(
      ['pbt-1']
    );
  });
});

describe('transcribeMediaForPassage (TT-5873)', () => {
  const sourceVern = media({
    id: 'src-vern',
    passage: 'source-pas',
    plan: 'source-plan',
    artifactType: null,
    version: 2,
    transcription: '\\v in the time of king herod',
  });
  const olderVern = media({
    id: 'src-vern-old',
    passage: 'source-pas',
    plan: 'source-plan',
    artifactType: null,
    version: 1,
  });
  const sourcePbt = media({
    id: 'src-pbt',
    passage: 'source-pas',
    plan: 'source-plan',
    artifactType: 'pbt',
    sourceMedia: 'src-vern',
    transcription: 'back translation text',
  });
  const otherPlanVern = media({
    id: 'link-vern',
    passage: 'link-pas',
    plan: 'link-plan',
    artifactType: null,
  });

  it('returns latest vernacular on the source passage even when it lives on another plan', () => {
    const result = transcribeMediaForPassage(
      [sourceVern, olderVern, sourcePbt, otherPlanVern],
      'source-pas',
      VernacularTag,
      true
    );
    expect(result.map((m) => m.id)).toEqual(['src-vern']);
    expect(result[0].attributes?.transcription).toContain('king herod');
  });

  it('returns PBT takes on the source passage even when they live on another plan', () => {
    const result = transcribeMediaForPassage(
      [sourceVern, olderVern, sourcePbt, otherPlanVern],
      'source-pas',
      'pbt',
      true
    );
    expect(result.map((m) => m.id)).toEqual(['src-pbt']);
    expect(result[0].attributes?.transcription).toBe('back translation text');
  });

  it('does not include PBT takes whose sourceMedia is not the latest vernacular', () => {
    const stalePbt = media({
      id: 'stale-pbt',
      passage: 'source-pas',
      plan: 'source-plan',
      artifactType: 'pbt',
      sourceMedia: 'src-vern-old',
    });
    const result = transcribeMediaForPassage(
      [sourceVern, olderVern, sourcePbt, stalePbt],
      'source-pas',
      'pbt',
      true
    );
    expect(result.map((m) => m.id)).toEqual(['src-pbt']);
  });

  it('returns nothing when the passage id is empty', () => {
    expect(
      transcribeMediaForPassage([sourceVern], '', VernacularTag, true)
    ).toEqual([]);
  });
});
