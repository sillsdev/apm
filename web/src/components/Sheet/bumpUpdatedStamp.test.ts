import { bumpUpdatedStamp } from './bumpUpdatedStamp';

const T = '2020-01-01T00:00:00.000Z';
const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();

describe('bumpUpdatedStamp', () => {
  it('keeps a stamp that is already newer than the save and the row', () => {
    const newer = '2020-01-02T00:00:00.000Z';
    expect(bumpUpdatedStamp(T, T, () => newer)).toBe(newer);
  });

  it('bumps a stamp equal to the last save', () => {
    expect(bumpUpdatedStamp(undefined, T, () => T)).toBe(plus(T, 1));
  });

  it('bumps a stamp equal to the previous row stamp', () => {
    expect(bumpUpdatedStamp(T, undefined, () => T)).toBe(plus(T, 1));
  });

  it('bumps again when the previous stamp is still ahead of the save floor', () => {
    const prev = plus(T, 1);
    expect(bumpUpdatedStamp(prev, T, () => T)).toBe(plus(T, 2));
  });
});
