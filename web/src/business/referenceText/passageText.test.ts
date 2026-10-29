import {
  chaptersInRange,
  parseChapter,
  passageText,
  planPassage,
  VerseRange,
} from './passageText';
import { ReferenceText } from './referenceText';
import { PassageD } from '../../model';
import { HelloAoSimpleChapterBody } from '../../model/helloAoChapter';
import jhn3 from './__fixtures__/BSB_JHN_3.simple.json';
import jhn4 from './__fixtures__/BSB_JHN_4.simple.json';
import psa3 from './__fixtures__/BSB_PSA_3.simple.json';
import act8 from './__fixtures__/BSB_ACT_8.simple.json';
import rom1Zad from './__fixtures__/zad_wbt_ROM_1.simple.json';

const chapter = (json: unknown): HelloAoSimpleChapterBody => {
  const body = parseChapter(json);
  if (!body) throw new Error('fixture is not a HelloAO simple chapter');
  return body;
};

const range = (
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number
): VerseRange => ({ startChapter, startVerse, endChapter, endVerse });

describe('parseChapter', () => {
  it('accepts a HelloAO simple chapter response', () => {
    expect(chapter(jhn3).number).toBe(3);
  });

  it('rejects other shapes', () => {
    expect(parseChapter(undefined)).toBeUndefined();
    expect(parseChapter({})).toBeUndefined();
    expect(
      parseChapter({ chapter: { number: '3', content: [] } })
    ).toBeUndefined();
    expect(parseChapter({ chapter: { number: 3 } })).toBeUndefined();
  });
});

describe('chaptersInRange', () => {
  it('lists one chapter for a range inside a chapter', () => {
    expect(chaptersInRange(range(3, 1, 3, 5))).toEqual([3]);
  });

  it('lists every chapter of a cross-chapter range', () => {
    expect(chaptersInRange(range(3, 35, 5, 2))).toEqual([3, 4, 5]);
  });

  it('lists none when the end is before the start', () => {
    expect(chaptersInRange(range(4, 1, 3, 1))).toEqual([]);
  });
});

describe('passageText', () => {
  it('returns a single verse', () => {
    expect(passageText([chapter(jhn3)], range(3, 1, 3, 1))).toBe(
      'Now there was a man of the Pharisees named Nicodemus, a leader of the Jews.'
    );
  });

  it('joins a verse range with single spaces and drops headings', () => {
    const text = passageText([chapter(jhn3)], range(3, 1, 3, 2));
    expect(text).toMatch(
      /^Now there was a man .* leader of the Jews\. He came to Jesus at night/
    );
    expect(text).not.toContain('Jesus and Nicodemus');
  });

  it('leaves footnotes out of the text', () => {
    const text = passageText([chapter(jhn3)], range(3, 3, 3, 3));
    expect(text).toContain('unless he is born again.');
    expect(text).not.toContain('born from above');
  });

  it('reads across chapters', () => {
    const text = passageText(
      [chapter(jhn3), chapter(jhn4)],
      range(3, 35, 4, 1)
    );
    expect(text).toMatch(/^The Father loves the Son/);
    expect(text).toContain('wrath of God remains on him.');
    expect(text).toMatch(/more disciples than John$/);
    expect(text).not.toContain('Samaritan');
  });

  it('turns poetry line breaks into spaces', () => {
    expect(passageText([chapter(psa3)], range(3, 3, 3, 3))).toBe(
      'But You, O LORD, are a shield around me, my glory, and the One who lifts my head.'
    );
  });

  it('includes a Psalm title when the range starts at verse 1', () => {
    expect(passageText([chapter(psa3)], range(3, 1, 3, 1))).toBe(
      'A Psalm of David, when he fled from his son Absalom. O LORD, how my foes have increased! How many rise up against me!'
    );
  });

  it('leaves out a Psalm title when the range starts later', () => {
    expect(passageText([chapter(psa3)], range(3, 2, 3, 3))).not.toContain(
      'Absalom'
    );
  });

  it('silently skips verses the translation omits', () => {
    const text = passageText([chapter(act8)], range(8, 36, 8, 38));
    expect(text).toMatch(/^As they traveled along the road/);
    expect(text).toMatch(/Philip baptized him\.$/);
  });

  it('reads a bridged verse, which HelloAO keys by its first number', () => {
    // zad_wbt bridges Romans 1:3-4 as one verse numbered 3
    const verse3 = chapter(rom1Zad).content.find(
      (c) => c.type === 'verse' && c.number === 3
    );
    const text = passageText([chapter(rom1Zad)], range(1, 3, 1, 5));
    expect(verse3 && 'text' in verse3 && text.startsWith(verse3.text)).toBe(
      true
    );
    expect(text).toMatch(/sho'e balaaṉ\.$/);
  });

  it('is empty when no verse is in range', () => {
    expect(passageText([chapter(act8)], range(8, 37, 8, 37))).toBe('');
    expect(passageText([chapter(jhn3)], range(3, 20, 3, 25))).toBe('');
    expect(passageText([], range(3, 1, 3, 1))).toBe('');
  });

  it('ignores chapters outside the range', () => {
    expect(passageText([chapter(jhn4)], range(3, 1, 3, 2))).toBe('');
  });
});

describe('planPassage', () => {
  const bsb: ReferenceText = {
    id: 'BSB',
    name: 'Berean Standard Bible',
    englishName: 'Berean Standard Bible',
    language: 'eng',
    textDirection: 'ltr',
    license: '',
    books: 'PSA JHN ACT',
  };

  const passage = (book: string, reference: string) =>
    ({
      id: 'p1',
      type: 'passage',
      attributes: { book, reference },
    }) as PassageD; // only book and reference are read

  it('is none without a Reference Text', () => {
    expect(planPassage(passage('JHN', '3:1-5'), undefined)).toEqual({
      status: 'none',
    });
  });

  it('is none without a passage', () => {
    expect(planPassage(undefined, bsb)).toEqual({ status: 'none' });
  });

  it('is none for a note', () => {
    expect(planPassage(passage('JHN', 'NOTE 1'), bsb)).toEqual({
      status: 'none',
    });
  });

  it('asks for the parsed range', () => {
    expect(planPassage(passage('JHN', '3:35-4:1'), bsb)).toEqual({
      status: 'fetch',
      referenceText: bsb,
      book: 'JHN',
      range: range(3, 35, 4, 1),
    });
  });

  it('asks for the range of the current reference, not stale chapter fields', () => {
    const edited = passage('JHN', '3:16-18');
    Object.assign(edited.attributes, {
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 5,
    });
    expect(planPassage(edited, bsb)).toMatchObject({
      status: 'fetch',
      range: range(3, 16, 3, 18),
    });
    expect(edited.attributes.startChapter).toBe(1);
  });

  it('treats a partial verse as the whole verse', () => {
    expect(planPassage(passage('JHN', '3:3a-5b'), bsb)).toMatchObject({
      status: 'fetch',
      range: range(3, 3, 3, 5),
    });
  });

  it('is bookNotInText when the Reference Text lacks the book', () => {
    expect(planPassage(passage('ROM', '1:1-7'), bsb)).toEqual({
      status: 'error',
      referenceText: bsb,
      error: 'bookNotInText',
    });
  });

  it('is noRange without a chapter and verse', () => {
    ['3', '', 'abc'].forEach((reference) =>
      expect(planPassage(passage('JHN', reference), bsb)).toEqual({
        status: 'error',
        referenceText: bsb,
        error: 'noRange',
      })
    );
  });
});
