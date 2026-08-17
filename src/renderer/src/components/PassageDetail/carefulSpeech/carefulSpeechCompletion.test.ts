import {
  firstIncompleteClauseIndex,
  getCompletedClauseIndices,
  getRecordingForClause,
} from './carefulSpeechCompletion';
import {
  matchesGuidedOutputRow,
  pickLatestGuidedOutputRow,
} from './matchesGuidedOutputRow';
import { IRegion } from '../../../crud/useWavesurferRegions';
import { IRow } from '../../../context/PassageDetailContext';

const regions: IRegion[] = [
  { start: 0, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
];

function makeRow(
  overrides: Partial<IRow> & {
    id: string;
    sourceMediaId?: string;
    sourceSegments?: string;
    languagebcp47?: string;
    dateCreated?: string;
  }
): IRow {
  const {
    id,
    sourceMediaId,
    sourceSegments = JSON.stringify({ start: 0, end: 10 }),
    languagebcp47,
    dateCreated,
    ...rest
  } = overrides;
  return {
    id,
    artifactType: 'Back translation',
    sourceVersion: 1,
    mediafile: {
      id: `${id}-mf`,
      type: 'mediafile',
      attributes: {
        sourceSegments,
        ...(languagebcp47 != null ? { languagebcp47 } : {}),
        ...(dateCreated != null ? { dateCreated } : {}),
      },
      relationships: {
        artifactType: { data: { id: 'art1', type: 'artifacttype' } },
        ...(sourceMediaId
          ? { sourceMedia: { data: { id: sourceMediaId, type: 'mediafile' } } }
          : {}),
      },
    } as IRow['mediafile'],
    ...rest,
  } as IRow;
}

describe('carefulSpeechCompletion', () => {
  it('firstIncompleteClauseIndex skips completed', () => {
    const completed = new Set([0]);
    expect(firstIncompleteClauseIndex(regions, completed)).toBe(1);
  });

  it('firstIncompleteClauseIndex returns length when all complete', () => {
    const completed = new Set([0, 1]);
    expect(firstIncompleteClauseIndex(regions, completed)).toBe(2);
  });

  it('getCompletedClauseIndices matches sourceSegments with sourceMedia', () => {
    const row = makeRow({ id: 'r1', sourceMediaId: 'vern1' });
    const completed = getCompletedClauseIndices(
      regions,
      [row],
      'art1',
      1,
      'vern1'
    );
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(false);
  });

  it('getCompletedClauseIndices tolerates small region drift', () => {
    const row = makeRow({
      id: 'r1',
      sourceMediaId: 'vern1',
      sourceSegments: JSON.stringify({ start: 0.02, end: 10.03 }),
    });
    const completed = getCompletedClauseIndices(
      regions,
      [row],
      'art1',
      1,
      'vern1'
    );
    expect(completed.has(0)).toBe(true);
  });

  it('does not match a row that only shares sourceVersion with a different sourceMedia', () => {
    const otherVern = makeRow({
      id: 'other',
      sourceVersion: 1,
      sourceMediaId: 'other-vern',
    });
    expect(
      getRecordingForClause(
        [otherVern],
        'art1',
        1,
        regions[0],
        'vern1'
      )
    ).toBeUndefined();
    expect(
      matchesGuidedOutputRow(otherVern, {
        artifactTypeId: 'art1',
        vernacularMediaId: 'vern1',
      })
    ).toBe(false);
  });

  it('matches a row linked to the current vernacular via sourceMedia', () => {
    const row = makeRow({
      id: 'current',
      sourceVersion: 0,
      sourceMediaId: 'vern1',
    });
    expect(
      getRecordingForClause([row], 'art1', 1, regions[0], 'vern1')?.id
    ).toBe('current');
  });

  it('picks the most recently created take among matching duplicates', () => {
    const older = makeRow({
      id: 'old',
      sourceMediaId: 'vern1',
      dateCreated: '2020-01-01T00:00:00.000Z',
    });
    const newer = makeRow({
      id: 'new',
      sourceMediaId: 'vern1',
      dateCreated: '2024-06-01T00:00:00.000Z',
    });
    expect(
      getRecordingForClause(
        [older, newer],
        'art1',
        1,
        regions[0],
        'vern1'
      )?.id
    ).toBe('new');
    expect(pickLatestGuidedOutputRow([older, newer])?.id).toBe('new');
  });

  it('filters by languagebcp47 when languageBcp47 is set', () => {
    const fr = makeRow({
      id: 'fr',
      sourceMediaId: 'vern1',
      languagebcp47: 'French|fr',
    });
    const en = makeRow({
      id: 'en',
      sourceMediaId: 'vern1',
      languagebcp47: 'English|en',
    });
    expect(
      getRecordingForClause(
        [fr, en],
        'art1',
        1,
        regions[0],
        'vern1',
        false,
        0,
        'en'
      )?.id
    ).toBe('en');
  });

  it('matches legacy Retell recordings with empty sourceSegments in single-segment mode', () => {
    const row = makeRow({
      id: 'r1',
      sourceMediaId: 'vern1',
      sourceSegments: '{}',
    });
    const completed = getCompletedClauseIndices(
      regions,
      [row],
      'art1',
      1,
      'vern1',
      true
    );
    expect(completed.has(0)).toBe(true);
    expect(completed.has(1)).toBe(false);
  });
});
