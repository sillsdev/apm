import { estimateAiTimeLabel, formatAiEstimatedTime } from './estimateAiTime';

describe('estimateAiTimeLabel', () => {
  it('states the estimate for a two minute recording', () => {
    expect(estimateAiTimeLabel(120)).toBe('~1:15');
  });

  it('states a fifteen second estimate when the recording has no duration', () => {
    expect(estimateAiTimeLabel(0)).toBe('~0:15');
  });

  it('fills the estimated time sentence for a two minute recording', () => {
    expect(formatAiEstimatedTime('Estimated time {0}', 120)).toBe(
      'Estimated time ~1:15'
    );
  });
});
