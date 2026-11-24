import { describe, expect, it } from '@jest/globals';
import { ignoreVs } from './ignoreVs';

describe('ignoreVs', () => {
  it('removes a plain verse marker', () => {
    expect(ignoreVs('\\v 1 words')).toBe('words');
  });

  it('removes a verse range marker', () => {
    expect(ignoreVs('\\v 1-5 ')).toBe('');
  });

  it.each(['\\v 1-5a ', '\\v 1a ', '\\v 1a-2b ', '\\v 3b'])(
    'removes the whole suffixed marker %s',
    (marker) => {
      expect(ignoreVs(marker)).toBe('');
    }
  );

  it('removes a multi-digit verse marker completely', () => {
    expect(ignoreVs('\\v 12 ')).toBe('');
  });

  it('keeps a word that follows a marker without a space', () => {
    expect(ignoreVs('\\v 1abc')).toBe('\\v 1abc');
  });

  it('passes undefined through', () => {
    expect(ignoreVs(undefined)).toBeUndefined();
  });
});
