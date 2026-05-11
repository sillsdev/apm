import {
  akuoBookToUsfm,
  projectDefaultToBurritoBookKey,
} from './akuoBookToUsfm';

describe('akuoBookToUsfm', () => {
  const num2 = (bookNum: number) =>
    ({ 1: 'GEN', 4: 'NUM', 40: 'MAT', 43: 'JHN' } as Record<number, string>)[
      bookNum
    ];

  it('maps A-prefixed slots to 1-based book numbers', () => {
    expect(akuoBookToUsfm('A01', num2)).toBe('GEN');
    expect(akuoBookToUsfm('A04', num2)).toBe('NUM');
  });

  it('maps B-prefixed slots to book numbers offset by 39', () => {
    expect(akuoBookToUsfm('B01', num2)).toBe('MAT');
    expect(akuoBookToUsfm('B04', num2)).toBe('JHN');
  });

  it('trims whitespace on the Akuo token', () => {
    expect(akuoBookToUsfm('  A01  ', num2)).toBe('GEN');
  });

  it('returns undefined for non-matching strings', () => {
    expect(akuoBookToUsfm('C01', num2)).toBeUndefined();
    expect(akuoBookToUsfm('A1', num2)).toBeUndefined();
    expect(akuoBookToUsfm('', num2)).toBeUndefined();
  });
});

describe('projectDefaultToBurritoBookKey', () => {
  const num2 = (bookNum: number) =>
    ({ 1: 'GEN', 4: 'NUM', 40: 'MAT', 43: 'JHN' } as Record<number, string>)[
      bookNum
    ];

  it('maps Akuo slots like akuoBookToUsfm', () => {
    expect(projectDefaultToBurritoBookKey('A01', num2)).toBe('GEN');
    expect(projectDefaultToBurritoBookKey('B01', num2)).toBe('MAT');
  });

  it('returns 3-digit general designations unchanged', () => {
    expect(projectDefaultToBurritoBookKey('010', num2)).toBe('010');
    expect(projectDefaultToBurritoBookKey('000', num2)).toBe('000');
  });

  it('returns undefined for unrecognized non-Akuo strings', () => {
    expect(projectDefaultToBurritoBookKey('not-a-book-code', num2)).toBeUndefined();
    expect(projectDefaultToBurritoBookKey('12', num2)).toBeUndefined();
  });
});
