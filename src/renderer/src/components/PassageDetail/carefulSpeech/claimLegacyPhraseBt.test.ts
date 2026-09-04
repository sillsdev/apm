import { planLegacyPhraseBtClaim } from './claimLegacyPhraseBt';
import { NamedRegions, updateSegments } from '../../../utils/namedSegments';
import { phraseBtBoundaryRegionName } from './matchesGuidedOutputRow';

describe('planLegacyPhraseBtClaim', () => {
  const vern = {
    id: 'v1',
    type: 'mediafile',
    attributes: {
      segments: JSON.stringify([
        {
          name: NamedRegions.BackTranslation,
          regionInfo: JSON.stringify({
            params: {},
            regions: [{ start: 0, end: 10 }],
          }),
        },
      ]),
    },
    relationships: {},
  } as any;

  const untagged = {
    id: 'p1',
    type: 'mediafile',
    attributes: { languagebcp47: '' },
    relationships: {
      artifactType: { data: { type: 'artifacttype', id: 'art1' } },
      sourceMedia: { data: { type: 'mediafile', id: 'v1' } },
    },
  } as any;

  const tagged = {
    id: 'p2',
    type: 'mediafile',
    attributes: { languagebcp47: 'English|en' },
    relationships: {
      artifactType: { data: { type: 'artifacttype', id: 'art1' } },
    },
  } as any;

  it('claims untagged PBTs and copies BT into BT:bcp47', () => {
    const result = planLegacyPhraseBtClaim({
      languageName: 'French',
      languageBcp47: 'fr',
      artifactTypeId: 'art1',
      vernacularMedia: [vern],
      outputMedia: [untagged, tagged],
    });
    expect(result.languageUpdates.get('p1')).toBe('French|fr');
    expect(result.languageUpdates.has('p2')).toBe(false);
    expect(result.segmentUpdates.has('v1')).toBe(true);
    const segs = result.segmentUpdates.get('v1')!;
    expect(segs).toContain(phraseBtBoundaryRegionName('fr'));
  });

  it('leaves untagged takes alone once a second language has boundaries', () => {
    // Sena has already been back-translated on this passage, so an untagged
    // take may be Sena's. The Hebrew step must not adopt it (TT-7643).
    const multiLang = {
      ...vern,
      attributes: {
        segments: updateSegments(
          phraseBtBoundaryRegionName('seh'),
          vern.attributes.segments,
          JSON.stringify({ params: {}, regions: [{ start: 0, end: 4 }] })
        ),
      },
    };
    const result = planLegacyPhraseBtClaim({
      languageName: 'Hebrew',
      languageBcp47: 'he',
      artifactTypeId: 'art1',
      vernacularMedia: [multiLang],
      outputMedia: [untagged, tagged],
    });
    expect(result.languageUpdates.size).toBe(0);
    // The step still gets its own boundaries seeded from the legacy bucket.
    expect(result.segmentUpdates.has('v1')).toBe(true);
  });

  it('still claims when only this language has boundaries', () => {
    const mine = {
      ...vern,
      attributes: {
        segments: updateSegments(
          phraseBtBoundaryRegionName('he'),
          vern.attributes.segments,
          JSON.stringify({ params: {}, regions: [{ start: 0, end: 4 }] })
        ),
      },
    };
    const result = planLegacyPhraseBtClaim({
      languageName: 'Hebrew',
      languageBcp47: 'he',
      artifactTypeId: 'art1',
      vernacularMedia: [mine],
      outputMedia: [untagged],
    });
    expect(result.languageUpdates.get('p1')).toBe('Hebrew|he');
  });

  it('ignores an empty bucket for another language', () => {
    const emptyOther = {
      ...vern,
      attributes: {
        segments: updateSegments(
          phraseBtBoundaryRegionName('seh'),
          vern.attributes.segments,
          JSON.stringify({ params: {}, regions: [] })
        ),
      },
    };
    const result = planLegacyPhraseBtClaim({
      languageName: 'Hebrew',
      languageBcp47: 'he',
      artifactTypeId: 'art1',
      vernacularMedia: [emptyOther],
      outputMedia: [untagged],
    });
    expect(result.languageUpdates.get('p1')).toBe('Hebrew|he');
  });

  it('does not overwrite an existing language bucket', () => {
    const already = {
      ...vern,
      attributes: {
        segments: updateSegments(
          phraseBtBoundaryRegionName('fr'),
          vern.attributes.segments,
          JSON.stringify({
            params: {},
            regions: [{ start: 0, end: 5 }],
          })
        ),
      },
    };
    const result = planLegacyPhraseBtClaim({
      languageName: 'French',
      languageBcp47: 'fr',
      artifactTypeId: 'art1',
      vernacularMedia: [already],
      outputMedia: [],
    });
    expect(result.segmentUpdates.size).toBe(0);
  });
});
