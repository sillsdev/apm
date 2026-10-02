import { boldDefaultSegParams } from '../components/PassageDetail/carefulSpeech/boldCarefulSpeechSegParams';
import { findClauseSplitPoint } from './clauseSplitSilence';

describe('findClauseSplitPoint', () => {
  const duration = 10;
  const params = boldDefaultSegParams;

  it('splits at the midpoint of the longest internal silence', () => {
    const peaks = new Array(100).fill(0.5);
    // Silence from index 40–59 (4.0–6.0 s); clause is 0–10 s
    for (let i = 40; i < 60; i++) peaks[i] = 0;

    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 10 },
      params
    );
    expect(split).toBeCloseTo(5, 1);
  });

  it('returns undefined when silence touches the clause start', () => {
    const peaks = new Array(100).fill(0.5);
    for (let i = 0; i < 15; i++) peaks[i] = 0;

    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 10 },
      params
    );
    expect(split).toBeUndefined();
  });

  it('returns undefined when silence touches the clause end', () => {
    const peaks = new Array(100).fill(0.5);
    for (let i = 85; i < 100; i++) peaks[i] = 0;

    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 10 },
      params
    );
    expect(split).toBeUndefined();
  });

  it('splits on short internal silence below auto-segment minimum silence length', () => {
    const peaks = new Array(1000).fill(0.5);
    // One peak of silence (~0.01 s) — shorter than timeThreshold (0.02 s)
    peaks[500] = 0;

    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 10 },
      params
    );
    expect(split).toBeCloseTo(5.005, 2);
  });

  it('returns undefined when sub-clauses would be shorter than minimum segment length', () => {
    const peaks = new Array(100).fill(0.5);
    // Narrow silence near the middle — both halves still long enough at 1.5s min
    for (let i = 49; i < 51; i++) peaks[i] = 0;

    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 2 },
      params
    );
    expect(split).toBeUndefined();
  });

  it('returns undefined when no qualifying silence exists', () => {
    const peaks = new Array(100).fill(0.5);
    const split = findClauseSplitPoint(
      peaks,
      duration,
      { start: 0, end: 10 },
      params
    );
    expect(split).toBeUndefined();
  });
});
