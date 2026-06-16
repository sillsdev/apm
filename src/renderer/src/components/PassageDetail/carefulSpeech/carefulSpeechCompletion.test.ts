import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
} from './carefulSpeechCompletion';
import { IRegion } from '../../../crud/useWavesurferRegions';
import { IRow } from '../../../context/PassageDetailContext';

const regions: IRegion[] = [
  { start: 0, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
];

describe('carefulSpeechCompletion', () => {
  it('firstIncompleteClauseIndex skips completed', () => {
    const completed = new Set([0]);
    expect(firstIncompleteClauseIndex(regions, completed)).toBe(1);
  });

  it('firstIncompleteClauseIndex returns length when all complete', () => {
    const completed = new Set([0, 1]);
    expect(firstIncompleteClauseIndex(regions, completed)).toBe(2);
  });

  it('getCompletedClauseIndices matches sourceSegments', () => {
    const row: IRow = {
      id: 'r1',
      artifactType: 'Careful speech',
      sourceVersion: 1,
      mediafile: {
        id: 'm1',
        type: 'mediafile',
        attributes: {
          sourceSegments: JSON.stringify({ start: 0, end: 10 }),
        },
        relationships: {
          artifactType: { data: { id: 'art1', type: 'artifacttype' } },
        },
      } as IRow['mediafile'],
    } as IRow;
    const completed = getCompletedClauseIndices(regions, [row], 'art1', 1);
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(false);
  });
});
