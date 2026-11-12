import { referenceTextRanks } from '../../../business/referenceText/referenceText';
import {
  compareReferenceTextId,
  compareReferenceTextRank,
} from './compareReferenceTextId';

describe('compareReferenceTextId', () => {
  it('prefixes the rank so it cannot collide with a mediafile id', () => {
    expect(compareReferenceTextId('primary')).toBe('referenceText:primary');
    expect(compareReferenceTextId('secondary')).toBe('referenceText:secondary');
  });
});

describe('compareReferenceTextRank', () => {
  it('round-trips every rank', () => {
    referenceTextRanks.forEach((rank) =>
      expect(compareReferenceTextRank(compareReferenceTextId(rank))).toBe(rank)
    );
  });

  it('returns undefined for an unknown reference text rank', () => {
    expect(compareReferenceTextRank('referenceText:foo')).toBeUndefined();
  });

  it('returns undefined for the bare prefix', () => {
    expect(compareReferenceTextRank('referenceText:')).toBeUndefined();
  });

  it('returns undefined for a mediafile id', () => {
    expect(
      compareReferenceTextRank('2f1c6b9e-7d4a-4f2b-9c1e-0a8b3d5e6f70')
    ).toBeUndefined();
  });

  it('returns undefined for a bare rank without the prefix', () => {
    expect(compareReferenceTextRank('primary')).toBeUndefined();
  });

  it('returns undefined for an empty id', () => {
    expect(compareReferenceTextRank('')).toBeUndefined();
  });

  it('is case sensitive', () => {
    expect(compareReferenceTextRank('referenceText:Primary')).toBeUndefined();
  });
});
