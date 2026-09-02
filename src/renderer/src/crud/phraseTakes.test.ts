import { describe, expect, it } from '@jest/globals';
import { MediaFile } from '../model';
import { IRegion } from './useWavesurferRegions';
import { selectCurrentPhraseTakes } from './phraseTakes';

/**
 * TT-7666 - a phrase segment's take records which slice of the vernacular it
 * covers in `sourceSegments`. Adjusting a boundary rewrites the slices, so the
 * takes made before the adjustment answer to a segment that no longer exists;
 * recording the moved segments again leaves both generations attached to the
 * same vernacular. The record step only ever shows takes matching the segments
 * it is looking at, but the Transcribe task list showed every take there was -
 * two segments, four tasks.
 */

const take = (
  id: string,
  region: { start: number; end: number } | null,
  dateCreated = '2026-01-01T00:00:00Z'
): MediaFile =>
  ({
    id,
    type: 'mediafile',
    attributes: {
      sourceSegments: region === null ? '' : JSON.stringify(region),
      dateCreated,
    },
  }) as unknown as MediaFile;

const ids = (media: MediaFile[]) => media.map((m) => m.id);

const region = (start: number, end: number): IRegion =>
  ({ start, end, label: '' }) as IRegion;

describe('selectCurrentPhraseTakes', () => {
  it('drops takes recorded against boundaries that no longer exist', () => {
    // Segments were [0,5] and [5,10], then the boundary moved to 6.
    const takes = [
      take('stale-1', { start: 0, end: 5 }, '2026-01-01T00:00:00Z'),
      take('stale-2', { start: 5, end: 10 }, '2026-01-01T00:01:00Z'),
      take('current-1', { start: 0, end: 6 }, '2026-01-01T00:02:00Z'),
      take('current-2', { start: 6, end: 10 }, '2026-01-01T00:03:00Z'),
    ];
    const result = selectCurrentPhraseTakes(takes, [
      region(0, 6),
      region(6, 10),
    ]);
    expect(ids(result)).toEqual(['current-1', 'current-2']);
  });

  it('keeps only the newest take of a segment recorded more than once', () => {
    const takes = [
      take('first', { start: 0, end: 6 }, '2026-01-01T00:00:00Z'),
      take('second', { start: 0, end: 6 }, '2026-01-02T00:00:00Z'),
    ];
    expect(ids(selectCurrentPhraseTakes(takes, [region(0, 6)]))).toEqual([
      'second',
    ]);
  });

  it('breaks a tie on the creation date by id so the choice is stable', () => {
    const takes = [
      take('aaa', { start: 0, end: 6 }, '2026-01-01T00:00:00Z'),
      take('bbb', { start: 0, end: 6 }, '2026-01-01T00:00:00Z'),
    ];
    expect(ids(selectCurrentPhraseTakes(takes, [region(0, 6)]))).toEqual([
      'bbb',
    ]);
    expect(
      ids(selectCurrentPhraseTakes([...takes].reverse(), [region(0, 6)]))
    ).toEqual(['bbb']);
  });

  it('matches a segment whose stored boundaries drifted within tolerance', () => {
    const takes = [take('drifted', { start: 0.01, end: 5.98 })];
    expect(ids(selectCurrentPhraseTakes(takes, [region(0, 6)]))).toEqual([
      'drifted',
    ]);
  });

  it('returns the takes untouched when the current segments are unknown', () => {
    // No boundaries to compare against (vernacular unreadable, or an artifact
    // that records no segment map) - nothing can be called stale, so nothing
    // may be hidden.
    const takes = [
      take('a', { start: 0, end: 5 }),
      take('b', { start: 5, end: 10 }),
    ];
    expect(ids(selectCurrentPhraseTakes(takes, []))).toEqual(['a', 'b']);
  });

  it('keeps takes that name no segment at all', () => {
    // Retell and pre-segment-map takes carry no `sourceSegments`. They cannot
    // be attributed to a segment, so they cannot be judged stale either.
    const takes = [
      take('whole-passage', null),
      take('stale', { start: 0, end: 5 }),
      take('current', { start: 0, end: 6 }),
    ];
    expect(ids(selectCurrentPhraseTakes(takes, [region(0, 6)]))).toEqual([
      'whole-passage',
      'current',
    ]);
  });

  it('keeps the order it was given', () => {
    const takes = [
      take('second', { start: 6, end: 10 }),
      take('first', { start: 0, end: 6 }),
    ];
    expect(
      ids(selectCurrentPhraseTakes(takes, [region(0, 6), region(6, 10)]))
    ).toEqual(['second', 'first']);
  });
});
