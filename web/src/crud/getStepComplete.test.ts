import Memory from '@orbit/memory';
import { Passage, StepComplete } from '../model';
import {
  getStepComplete,
  passageRecordForStepComplete,
} from './getStepComplete';

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

describe('passageRecordForStepComplete', () => {
  it('prefers memory cache over a stale passages snapshot', () => {
    const completed: StepComplete[] = [
      { stepid: 's1', complete: true, name: 'Transcribe' },
    ];
    const fresh = {
      id: 'p1',
      type: 'passage',
      attributes: { stepComplete: JSON.stringify({ completed }) },
    };
    const stale = {
      id: 'p1',
      type: 'passage',
      attributes: { stepComplete: '{}' },
    } as Passage;
    const memory = {
      cache: {
        query: () => fresh,
      },
    } as unknown as Memory;

    const p = passageRecordForStepComplete(memory, 'p1', [stale]);
    expect(getStepComplete(p as Passage)).toEqual(completed);
  });

  it('falls back to passages when memory has no record', () => {
    const stale = {
      id: 'p1',
      type: 'passage',
      attributes: {
        stepComplete: JSON.stringify({
          completed: [{ stepid: 's1', complete: false, name: 'Transcribe' }],
        }),
      },
    } as Passage;
    const memory = {
      cache: {
        query: () => {
          throw new Error('not found');
        },
      },
    } as unknown as Memory;

    const p = passageRecordForStepComplete(memory, 'p1', [stale]);
    expect(p).toBe(stale);
  });
});
