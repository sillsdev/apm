import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
  getRecordingForClause,
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

  it('getCompletedClauseIndices tolerates small region drift', () => {
    const row: IRow = {
      id: 'r1',
      artifactType: 'Back translation',
      sourceVersion: 1,
      mediafile: {
        id: 'm1',
        type: 'mediafile',
        attributes: {
          sourceSegments: JSON.stringify({ start: 0.02, end: 10.03 }),
        },
        relationships: {
          artifactType: { data: { id: 'art1', type: 'artifacttype' } },
          sourceMedia: { data: { id: 'vern1', type: 'mediafile' } },
        },
      } as IRow['mediafile'],
    } as IRow;
    const completed = getCompletedClauseIndices(
      regions,
      [row],
      'art1',
      1,
      'vern1'
    );
    expect(completed.has(0)).toBe(true);
  });

  it('prefers the current source version when multiple rows match', () => {
    const oldRow: IRow = {
      id: 'old',
      artifactType: 'Back translation',
      sourceVersion: 0,
      mediafile: {
        id: 'old-mf',
        type: 'mediafile',
        attributes: {
          sourceSegments: JSON.stringify({ start: 0, end: 10 }),
          transcription: 'stale transcription',
        },
        relationships: {
          artifactType: { data: { id: 'art1', type: 'artifacttype' } },
          sourceMedia: { data: { id: 'vern1', type: 'mediafile' } },
        },
      } as IRow['mediafile'],
    } as IRow;
    const currentRow: IRow = {
      id: 'current',
      artifactType: 'Back translation',
      sourceVersion: 1,
      mediafile: {
        id: 'current-mf',
        type: 'mediafile',
        attributes: {
          sourceSegments: JSON.stringify({ start: 0, end: 10 }),
          transcription: '',
        },
        relationships: {
          artifactType: { data: { id: 'art1', type: 'artifacttype' } },
          sourceMedia: { data: { id: 'vern1', type: 'mediafile' } },
        },
      } as IRow['mediafile'],
    } as IRow;

    expect(
      getRecordingForClause(
        [oldRow, currentRow],
        'art1',
        1,
        regions[0],
        'vern1'
      )?.id
    ).toBe('current');
  });

  it('matches legacy Retell recordings with empty sourceSegments in single-segment mode', () => {
    const row: IRow = {
      id: 'r1',
      artifactType: 'Retell',
      sourceVersion: 1,
      mediafile: {
        id: 'm1',
        type: 'mediafile',
        attributes: {
          sourceSegments: '{}',
        },
        relationships: {
          artifactType: { data: { id: 'art1', type: 'artifacttype' } },
        },
      } as IRow['mediafile'],
    } as IRow;
    const completed = getCompletedClauseIndices(
      regions,
      [row],
      'art1',
      1,
      undefined,
      true
    );
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(false);
  });
});
