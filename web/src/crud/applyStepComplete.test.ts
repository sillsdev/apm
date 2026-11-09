import { applyStepComplete, stepsCompleteThrough } from './applyStepComplete';
import { StepComplete } from '../model';

describe('applyStepComplete', () => {
  const base: StepComplete[] = [
    { stepid: '1', complete: true, name: 'Record' },
    { stepid: '2', complete: false, name: 'Transcribe' },
  ];

  it('updates an existing step immutably', () => {
    const next = applyStepComplete(base, '2', true, 'Transcribe');
    expect(next).not.toBe(base);
    expect(next[1]).toEqual({
      stepid: '2',
      complete: true,
      name: 'Transcribe',
    });
    expect(base[1].complete).toBe(false);
  });

  it('appends a missing step', () => {
    const next = applyStepComplete(base, '3', true, 'Review');
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({ stepid: '3', complete: true, name: 'Review' });
  });

  it('returns the same array when nothing changes', () => {
    expect(applyStepComplete(base, '1', true, 'Record')).toBe(base);
  });

  it('keeps prior updates when applied sequentially', () => {
    let list = base;
    list = applyStepComplete(list, '2', false, 'Transcribe');
    list = applyStepComplete(list, '1', false, 'Record');
    expect(list).toEqual([
      { stepid: '1', complete: false, name: 'Record' },
      { stepid: '2', complete: false, name: 'Transcribe' },
    ]);
  });
});

describe('stepsCompleteThrough', () => {
  const steps = [
    { id: 'a', attributes: { sequencenum: 2, name: 'Transcribe' } },
    { id: 'b', attributes: { sequencenum: 1, name: 'Record' } },
    { id: 'c', attributes: { sequencenum: 3, name: 'Review' } },
  ];

  it('marks steps in sequence order through the target', () => {
    expect(stepsCompleteThrough(steps, 'a', (id) => `r-${id}`)).toEqual([
      { stepid: 'r-b', complete: true, name: 'Record' },
      { stepid: 'r-a', complete: true, name: 'Transcribe' },
    ]);
  });

  it('does not mutate the input steps array', () => {
    const copy = steps.map((s) => ({ ...s, attributes: { ...s.attributes } }));
    stepsCompleteThrough(steps, 'c', (id) => id);
    expect(steps.map((s) => s.attributes.sequencenum)).toEqual(
      copy.map((s) => s.attributes.sequencenum)
    );
  });

  it('returns [] for an unknown step instead of marking all complete', () => {
    expect(stepsCompleteThrough(steps, 'zzz', (id) => id)).toEqual([]);
  });
});
