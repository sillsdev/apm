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
