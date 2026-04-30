import type { MediaFileD, PassageD, SectionD } from '../model';
import { firstMissingTranscriptionRefsForVernacularAudio } from './vernacularAudioWarnings';

function section(id: string, planId: string, seq = 1): SectionD {
  return {
    id,
    type: 'section',
    attributes: { sequencenum: seq } as any,
    relationships: {
      plan: { data: { type: 'plan', id: planId } },
    },
  } as any;
}

function passage(
  id: string,
  sectionId: string,
  reference: string,
  seq = 1
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: { reference, sequencenum: seq } as any,
    relationships: {
      section: { data: { type: 'section', id: sectionId } },
    },
  } as any;
}

function mediafile(
  id: string,
  planId: string,
  passageId: string,
  versionNumber: number,
  transcription: string | null,
  artifactTypeId: string | null = null
): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: {
      versionNumber,
      transcription,
    } as any,
    relationships: {
      plan: { data: { type: 'plan', id: planId } },
      passage: { data: { type: 'passage', id: passageId } },
      artifactType: artifactTypeId
        ? { data: { type: 'artifacttype', id: artifactTypeId } }
        : { data: null },
    },
  } as any;
}

describe('firstMissingTranscriptionRefsForVernacularAudio', () => {
  it('returns refs when any exported vernacular media has blank transcription', () => {
    const sections = [section('s1', 'plan1')];
    const passages = [
      passage('p1', 's1', 'GEN 1:1', 1),
      passage('p2', 's1', 'GEN 1:2', 2),
    ];
    const mediafiles = [
      mediafile('m1', 'plan1', 'p1', 2, '   '), // missing after trim
      mediafile('m2', 'plan1', 'p2', 1, 'hello'),
    ];

    const refs = firstMissingTranscriptionRefsForVernacularAudio({
      sections,
      passages,
      mediafiles,
      versions: 1,
      maxRefs: 10,
    });

    expect(refs).toEqual(['GEN 1:1']);
  });

  it('respects versions limit and sorting (newest only)', () => {
    const sections = [section('s1', 'plan1')];
    const passages = [passage('p1', 's1', 'GEN 1:1', 1)];
    const mediafiles = [
      mediafile('m-old', 'plan1', 'p1', 1, '   '), // missing but older
      mediafile('m-new', 'plan1', 'p1', 2, 'ok'), // newest OK
    ];

    const refs = firstMissingTranscriptionRefsForVernacularAudio({
      sections,
      passages,
      mediafiles,
      versions: 1,
      maxRefs: 10,
    });

    expect(refs).toEqual([]);
  });

  it('does not include non-vernacular media (artifactType present)', () => {
    const sections = [section('s1', 'plan1')];
    const passages = [passage('p1', 's1', 'GEN 1:1', 1)];
    const mediafiles = [
      mediafile('m1', 'plan1', 'p1', 1, '   ', 'artifact-type-1'),
    ];

    const refs = firstMissingTranscriptionRefsForVernacularAudio({
      sections,
      passages,
      mediafiles,
      versions: 1,
      maxRefs: 10,
    });

    expect(refs).toEqual([]);
  });

  it('caps to maxRefs (default 10)', () => {
    const sections = [section('s1', 'plan1')];
    const passages: PassageD[] = [];
    const mediafiles: MediaFileD[] = [];

    for (let i = 1; i <= 12; i++) {
      const pId = `p${i}`;
      const ref = `GEN 1:${i}`;
      passages.push(passage(pId, 's1', ref, i));
      mediafiles.push(mediafile(`m${i}`, 'plan1', pId, 1, ''));
    }

    const refs = firstMissingTranscriptionRefsForVernacularAudio({
      sections,
      passages,
      mediafiles,
      versions: 1,
    });

    expect(refs).toHaveLength(10);
    expect(refs[0]).toBe('GEN 1:1');
    expect(refs[9]).toBe('GEN 1:10');
  });
});

