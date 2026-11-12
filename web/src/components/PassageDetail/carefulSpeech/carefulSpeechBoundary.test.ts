import { describe, expect, it } from '@jest/globals';
import {
  clauseIndexForRegion,
  preservesRecordedBoundaries,
  regionBoundariesEqual,
} from './carefulSpeechBoundary';

describe('regionBoundariesEqual', () => {
  it('ignores labels and params', () => {
    const a = JSON.stringify({
      params: { a: 1 },
      regions: [{ start: 0, end: 1, label: '1' }],
    });
    const b = JSON.stringify({
      params: {},
      regions: [{ start: 0, end: 1, label: '' }],
    });
    expect(regionBoundariesEqual(a, b)).toBe(true);
  });

  it('detects boundary drift', () => {
    const a = JSON.stringify({ regions: [{ start: 0, end: 1 }] });
    const b = JSON.stringify({ regions: [{ start: 0, end: 2 }] });
    expect(regionBoundariesEqual(a, b)).toBe(false);
  });
});

describe('preservesRecordedBoundaries', () => {
  it('allows edits that keep recorded regions intact', () => {
    const oldRegions = [
      { start: 0, end: 1 },
      { start: 1, end: 3 },
    ];
    const newRegions = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ];
    expect(
      preservesRecordedBoundaries(oldRegions, newRegions, new Set([0]))
    ).toBe(true);
  });

  it('rejects split of a recorded region', () => {
    const oldRegions = [
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ];
    const newRegions = [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
    ];
    expect(
      preservesRecordedBoundaries(oldRegions, newRegions, new Set([0]))
    ).toBe(false);
  });
});

describe('clauseIndexForRegion', () => {
  const regions = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
    { start: 20, end: 30 },
  ];

  it('finds the clause whose boundaries match', () => {
    expect(clauseIndexForRegion({ start: 10, end: 20 }, regions)).toBe(1);
  });

  it('tracks a take to its new index after an earlier clause splits', () => {
    // A take was recorded on { 10, 20 } (index 1). Splitting clause 0 shifts it
    // to index 2, but its boundaries are unchanged — the match follows.
    const afterSplit = [
      { start: 0, end: 5 },
      { start: 5, end: 10 },
      { start: 10, end: 20 },
      { start: 20, end: 30 },
    ];
    expect(clauseIndexForRegion({ start: 10, end: 20 }, afterSplit)).toBe(2);
  });

  it('matches within tolerance and returns -1 when no clause lines up', () => {
    expect(clauseIndexForRegion({ start: 10.02, end: 19.98 }, regions)).toBe(1);
    expect(clauseIndexForRegion({ start: 12, end: 18 }, regions)).toBe(-1);
  });
});
