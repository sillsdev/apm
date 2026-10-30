import { speechChunks } from './speechChunks';

describe('speechChunks', () => {
  it('keeps short text as one chunk', () => {
    expect(speechChunks('For God so loved the world.', 'en')).toEqual([
      'For God so loved the world.',
    ]);
  });

  it('joins sentences up to the limit', () => {
    expect(speechChunks('One. Two. Three.', 'en', 10)).toEqual([
      'One. Two. ',
      'Three.',
    ]);
  });

  it('splits an overlong sentence at spaces', () => {
    expect(speechChunks('aaaa bbbb cccc', 'en', 10)).toEqual([
      'aaaa bbbb ',
      'cccc',
    ]);
  });

  it('cuts a sentence with no spaces at the limit', () => {
    expect(speechChunks('一二三四五六七八九十一二', 'zh', 10)).toEqual([
      '一二三四五六七八九十',
      '一二',
    ]);
  });

  it('loses no characters, so offsets add up to the text', () => {
    const text = 'In the beginning was the Word. And the Word was with God.';
    expect(speechChunks(text, 'en', 20).join('')).toBe(text);
  });

  it('returns nothing for blank text', () => {
    expect(speechChunks('  ', 'en')).toEqual([]);
  });
});
