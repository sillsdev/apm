import { Passage, StepComplete } from '../model';
import { getStepComplete } from './getStepComplete';

describe('getStepComplete', () => {
  it('reads completed from stepComplete json', () => {
    const completed: StepComplete[] = [
      { stepid: 's1', complete: true, name: 'Transcribe' },
    ];
    const p = {
      id: 'p1',
      attributes: { stepComplete: JSON.stringify({ completed }) },
    } as Passage;
    expect(getStepComplete(p)).toEqual(completed);
  });

  it.each([
    ['undefined passage', undefined],
    ['empty string', ''],
    ['empty object', '{}'],
    ['malformed json', '{"completed": ['],
    ['missing completed', '{"other": 1}'],
    ['non-array completed', '{"completed": "x"}'],
    ['json null', 'null'],
  ])('returns [] for %s', (_label, stepComplete) => {
    const p =
      stepComplete === undefined
        ? undefined
        : ({ id: 'p1', attributes: { stepComplete } } as Passage);
    expect(getStepComplete(p)).toEqual([]);
  });
});
