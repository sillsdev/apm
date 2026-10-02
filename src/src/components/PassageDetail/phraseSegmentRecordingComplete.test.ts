import { describe, expect, it } from '@jest/globals';
import { IRegion } from '../../crud/useWavesurferRegions';
import { IRow } from '../../context/PassageDetailContext';
import { hasIncompletePhraseSegmentRecordings } from './phraseSegmentRecordingComplete';

const regions: IRegion[] = [
  { start: 0, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
];

function makeRow(
  start: number,
  end: number,
  opts?: { languagebcp47?: string }
): IRow {
  return {
    id: `r-${start}-${end}`,
    artifactType: 'Back translation',
    sourceVersion: 1,
    mediafile: {
      id: `mf-${start}-${end}`,
      type: 'mediafile',
      attributes: {
        sourceSegments: JSON.stringify({ start, end }),
        ...(opts?.languagebcp47 != null
          ? { languagebcp47: opts.languagebcp47 }
          : {}),
        dateCreated: '2026-01-01',
      },
      relationships: {
        artifactType: { data: { id: 'art-pbt', type: 'artifacttype' } },
        sourceMedia: { data: { id: 'vern-1', type: 'mediafile' } },
      },
    } as IRow['mediafile'],
  } as IRow;
}

describe('hasIncompletePhraseSegmentRecordings', () => {
  it('is false when there are no phrase regions yet', () => {
    expect(
      hasIncompletePhraseSegmentRecordings([], [], 'art-pbt', 1, 'vern-1')
    ).toBe(false);
  });

  it('is true when any region lacks a matching recording', () => {
    expect(
      hasIncompletePhraseSegmentRecordings(
        regions,
        [makeRow(0, 10)],
        'art-pbt',
        1,
        'vern-1'
      )
    ).toBe(true);
  });

  it('is false when every region has a matching recording', () => {
    expect(
      hasIncompletePhraseSegmentRecordings(
        regions,
        [makeRow(0, 10), makeRow(10, 20)],
        'art-pbt',
        1,
        'vern-1'
      )
    ).toBe(false);
  });

  it('respects language filter when provided', () => {
    expect(
      hasIncompletePhraseSegmentRecordings(
        regions,
        [
          makeRow(0, 10, { languagebcp47: 'LWC|en' }),
          makeRow(10, 20, { languagebcp47: 'LWC|fr' }),
        ],
        'art-pbt',
        1,
        'vern-1',
        'en'
      )
    ).toBe(true);
  });
});
