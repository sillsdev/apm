import { MediaFileD } from '../model';
import { latestTakePerSourceSegment } from './latestTakePerSourceSegment';

/**
 * TT-7666 - the Transcribe task list was built from artifact type (and, since
 * TT-7557, step language) alone, so every take a segment had ever carried
 * arrived as its own task. Superseded takes read as extra work to transcribe,
 * and the transcriber could not tell which one the phrase step is showing.
 */

const take = (
  id: string,
  seg: { start: number; end: number } | string | null,
  dateCreated: string,
  sourceMedia = 'mf-vern'
): MediaFileD =>
  ({
    id,
    type: 'mediafile',
    attributes: {
      dateCreated,
      sourceSegments:
        seg === null
          ? null
          : typeof seg === 'string'
            ? seg
            : JSON.stringify({ ...seg, label: '' }),
    },
    relationships: {
      sourceMedia: { data: { type: 'mediafile', id: sourceMedia } },
    },
  }) as unknown as MediaFileD;

const ids = (media: MediaFileD[]) => media.map((m) => m.id);

describe('latestTakePerSourceSegment', () => {
  it('keeps only the newest take of a segment', () => {
    const media = [
      take('old', { start: 0, end: 3 }, '2026-08-01T10:00:00Z'),
      take('new', { start: 0, end: 3 }, '2026-08-02T10:00:00Z'),
      take('other-segment', { start: 3, end: 6 }, '2026-08-01T10:00:00Z'),
    ];
    expect(ids(latestTakePerSourceSegment(media))).toEqual([
      'new',
      'other-segment',
    ]);
  });

  it('keeps the newest whichever order they arrive in', () => {
    const media = [
      take('new', { start: 0, end: 3 }, '2026-08-02T10:00:00Z'),
      take('old', { start: 0, end: 3 }, '2026-08-01T10:00:00Z'),
    ];
    expect(ids(latestTakePerSourceSegment(media))).toEqual(['new']);
  });

  it('breaks a dateCreated tie the way the phrase step does', () => {
    const media = [
      take('aaa', { start: 0, end: 3 }, '2026-08-01T10:00:00Z'),
      take('zzz', { start: 0, end: 3 }, '2026-08-01T10:00:00Z'),
    ];
    // isNewerTake, which the phrase step's own pick also calls.
    expect(ids(latestTakePerSourceSegment(media))).toEqual(['zzz']);
  });

  it('treats the same segment on a different vernacular as its own', () => {
    const media = [
      take('v1-take', { start: 0, end: 3 }, '2026-08-01T10:00:00Z', 'mf-v1'),
      take('v2-take', { start: 0, end: 3 }, '2026-08-02T10:00:00Z', 'mf-v2'),
    ];
    expect(ids(latestTakePerSourceSegment(media))).toEqual([
      'v1-take',
      'v2-take',
    ]);
  });

  it('ignores boundary noise below the display precision', () => {
    const media = [
      take('old', { start: 0, end: 3.001 }, '2026-08-01T10:00:00Z'),
      take('new', { start: 0, end: 3.002 }, '2026-08-02T10:00:00Z'),
    ];
    expect(ids(latestTakePerSourceSegment(media))).toEqual(['new']);
  });

  it('leaves media that are not per-segment takes alone', () => {
    const media = [
      take('vernacular', null, '2026-08-01T10:00:00Z'),
      take('whole-bt', '{}', '2026-08-02T10:00:00Z'),
      take('unparseable', 'not json', '2026-08-03T10:00:00Z'),
    ];
    expect(ids(latestTakePerSourceSegment(media))).toEqual([
      'vernacular',
      'whole-bt',
      'unparseable',
    ]);
  });

  it('returns an empty list unchanged', () => {
    expect(latestTakePerSourceSegment([])).toEqual([]);
  });
});
