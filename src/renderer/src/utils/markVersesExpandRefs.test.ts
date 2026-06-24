import { expandMarkVersesRefs } from './markVersesExpandRefs';

// engVrs is only consulted for cross-chapter ranges. Provide Genesis-like
// chapter lengths so any cross-chapter case has data to work with.
const engVrs = new Map<string, number[]>([['GEN', [31, 25, 24, 26]]]);
const expand = (ref: string) => expandMarkVersesRefs(ref, 'GEN', engVrs);

describe('expandMarkVersesRefs - whole verses (works today)', () => {
  it('expands a single whole verse', () => {
    expect(expand('1:5')).toEqual(['1:5']);
  });

  it('expands a same-chapter whole-verse range', () => {
    expect(expand('1:1-3')).toEqual(['1:1', '1:2', '1:3']);
  });
});

// These document the expansion bugs that remain after the validation fix.
// `getRefs` builds the per-row "expandedRefs" the validation consumes, so a
// mangled expansion makes the validation reject references the user typed
// correctly (the `35:22b-26`-style QA repro).
describe('expandMarkVersesRefs - sub-verse forms (BUG: currently mangled)', () => {
  it('does not duplicate a single sub-verse reference (1:2a)', () => {
    // Currently returns ['1:2a', '1:2a']: the verse is emitted once as the
    // "first verse" and again as the "last verse", and the duplicate then trips
    // the validation's repeated/overlapping-part check.
    expect(expand('1:2a')).toEqual(['1:2a']);
  });

  it('keeps the verse number on a same-verse letter range (1:22a-b)', () => {
    // Currently returns ['1:22a', '1:b']: the range end (refMatch group 3 = 'b')
    // is emitted as `${chapter}:${letter}`, dropping the verse number entirely.
    expect(expand('1:22a-b')).toEqual(['1:22a', '1:22b']);
  });

  it('keeps the verse number on a same-verse letter range (3:4b-c)', () => {
    // Currently returns ['3:4b', '3:c'].
    expect(expand('3:4b-c')).toEqual(['3:4b', '3:4c']);
  });

  it('does not duplicate a single sub-verse reference with a later letter (1:2c)', () => {
    // Currently returns ['1:2c', '1:2c'].
    expect(expand('1:2c')).toEqual(['1:2c']);
  });
});

describe('expandMarkVersesRefs - sub-verse range boundaries (works today)', () => {
  it('expands a range ending mid-verse (35:16-22a)', () => {
    expect(expand('35:16-22a')).toEqual([
      '35:16',
      '35:17',
      '35:18',
      '35:19',
      '35:20',
      '35:21',
      '35:22a',
    ]);
  });

  it('expands a range starting mid-verse (35:22b-26)', () => {
    expect(expand('35:22b-26')).toEqual([
      '35:22b',
      '35:23',
      '35:24',
      '35:25',
      '35:26',
    ]);
  });
});
