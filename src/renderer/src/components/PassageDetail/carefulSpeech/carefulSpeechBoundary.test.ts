import { describe, expect, it } from '@jest/globals';
import {
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
