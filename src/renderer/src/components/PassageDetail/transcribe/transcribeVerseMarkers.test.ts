import {
  applyVerseMarkerForRegionPosition,
  applyVerseMarkerToText,
  seedFirstVerseMarker,
  seedVerseMarkerText,
  transcriptionHasVerseMarker,
} from './transcribeVerseMarkers';

describe('transcribeVerseMarkers', () => {
  const regions = [
    { start: 0, end: 5, label: '1:1' },
    { start: 5, end: 10, label: '1:2' },
  ];

  it('seeds first verse marker into empty transcription', () => {
    expect(seedFirstVerseMarker('', regions)).toBe('\\v 1 ');
  });

  it('does not seed when transcription already has content', () => {
    expect(seedFirstVerseMarker('existing', regions)).toBe('existing');
  });

  it('builds seed marker text', () => {
    expect(seedVerseMarkerText('1:11')).toBe('\\v 11 ');
  });

  it('inserts marker on region navigation when missing', () => {
    const result = applyVerseMarkerForRegionPosition('', regions, 5);
    expect(result).toContain('\\v 2 ');
  });

  it('skips insert when marker already exists', () => {
    const text = '\\v 2 ';
    expect(applyVerseMarkerToText(text, '1:2')).toBe(text);
  });

  it('adds chapter marker for 1:1', () => {
    const result = applyVerseMarkerToText('', '1:1');
    expect(result).toContain('\\c 1');
    expect(result).toContain('\\v 1 ');
  });

  it('detects existing markers', () => {
    expect(transcriptionHasVerseMarker('\\v 3 text', '3')).toBe(true);
    expect(transcriptionHasVerseMarker('\\v 4 ', '3')).toBe(false);
  });
});
