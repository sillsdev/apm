import {
  AI_SAMPLE_WINDOW,
  AiTimingSample,
  estimateAiSeconds,
  estimateFromSamples,
  fallbackEstimateSeconds,
  p95,
  readAiSamples,
  recordAiSample,
} from './estimateAiTime';

const sample = (durationSec: number, totalSec: number): AiTimingSample => ({
  durationSec,
  totalMs: totalSec * 1000,
  at: 0,
});

describe('fallbackEstimateSeconds', () => {
  it('estimates half the recording plus fifteen seconds', () => {
    expect(fallbackEstimateSeconds(120)).toBe(75);
  });

  it('estimates fifteen seconds when the recording has no duration', () => {
    expect(fallbackEstimateSeconds(0)).toBe(15);
  });
});

describe('p95', () => {
  it('returns zero for no values', () => {
    expect(p95([])).toBe(0);
  });

  it('returns the only value', () => {
    expect(p95([7])).toBe(7);
  });

  it('returns the 95th of 100 values by nearest rank', () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i);
    expect(p95(values)).toBe(95);
  });
});

describe('estimateFromSamples', () => {
  it('follows an exact straight line', () => {
    // total = 10 + 0.5 * duration
    const samples = [10, 20, 40, 80, 160].map((d) => sample(d, 10 + d / 2));
    expect(estimateFromSamples(samples, 100)).toBe(60);
  });

  it('adds the slow tail on top of the fitted line', () => {
    const samples = [10, 20, 40, 80, 160].map((d) => sample(d, 10 + d / 2));
    samples.push(sample(40, 30 + 60)); // a cold start took 60s longer
    expect(estimateFromSamples(samples, 100)).toBeGreaterThan(60 + 40);
  });

  it('uses the slowest typical total when every clip is the same length', () => {
    const samples = [20, 22, 25, 30, 90].map((total) => sample(60, total));
    expect(estimateFromSamples(samples, 600)).toBe(90);
  });

  it('never predicts less time for longer audio', () => {
    // Longer clips happened to finish faster: the slope would be negative.
    const samples = [
      sample(10, 50),
      sample(20, 45),
      sample(40, 40),
      sample(80, 35),
      sample(160, 30),
    ];
    expect(estimateFromSamples(samples, 300)).toBeGreaterThanOrEqual(
      estimateFromSamples(samples, 10)
    );
  });

  it('never predicts negative overhead', () => {
    // total = -20 + 1 * duration on these points
    const samples = [40, 60, 80, 100, 120].map((d) => sample(d, d - 20));
    expect(estimateFromSamples(samples, 0)).toBeGreaterThanOrEqual(0);
  });

  it('stops at the cap', () => {
    const samples = [10, 20, 40, 80, 160].map((d) => sample(d, 10 + d / 2));
    expect(estimateFromSamples(samples, 10000, 600)).toBe(600);
  });
});

describe('estimateAiSeconds', () => {
  beforeEach(() => localStorage.clear());

  it('uses the fallback before five samples are recorded', () => {
    [10, 20, 40, 80].forEach((d) =>
      recordAiSample('noiseremoval', sample(d, d * 3))
    );
    expect(estimateAiSeconds('noiseremoval', 120)).toBe(75);
  });

  it('uses the recorded samples once there are five', () => {
    [10, 20, 40, 80, 160].forEach((d) =>
      recordAiSample('noiseremoval', sample(d, 10 + d / 2))
    );
    expect(estimateAiSeconds('noiseremoval', 100)).toBe(60);
  });

  it('keeps samples for each operation apart', () => {
    [10, 20, 40, 80, 160].forEach((d) =>
      recordAiSample('voiceconversion', sample(d, d * 3))
    );
    expect(estimateAiSeconds('noiseremoval', 120)).toBe(75);
  });

  it('caps the fallback too', () => {
    expect(estimateAiSeconds('noiseremoval', 3600, 600)).toBe(600);
  });

  it('keeps only the most recent samples', () => {
    for (let i = 0; i < AI_SAMPLE_WINDOW + 5; i++)
      recordAiSample('noiseremoval', sample(i, i));
    const samples = readAiSamples('noiseremoval');
    expect(samples).toHaveLength(AI_SAMPLE_WINDOW);
    expect(samples[0]?.durationSec).toBe(5);
  });

  it('uses the fallback when the stored samples are corrupt', () => {
    localStorage.setItem('aiTiming-noiseremoval', '{not json');
    expect(estimateAiSeconds('noiseremoval', 120)).toBe(75);
  });

  it('ignores stored entries that are not samples', () => {
    localStorage.setItem(
      'aiTiming-noiseremoval',
      JSON.stringify([sample(10, 20), { durationSec: 'x' }, null])
    );
    expect(readAiSamples('noiseremoval')).toEqual([sample(10, 20)]);
  });
});
