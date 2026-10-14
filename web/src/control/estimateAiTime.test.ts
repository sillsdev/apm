import { estimateAiTimeLabel } from './estimateAiTime';

describe('estimateAiTimeLabel', () => {
  it('states the estimate for a two minute recording', () => {
    expect(estimateAiTimeLabel(120)).toBe('~1:15');
  });
});
