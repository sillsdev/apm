import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { parseRef } from '../../crud/passage';
import { PassageD } from '../../model';
import {
  HelloAoSimpleChapterBody,
  HelloAoSimpleContent,
} from '../../model/helloAoChapter';
import { PassageTypeEnum } from '../../model/passageTypeEnum';
import { hasBook, ReferenceText } from './referenceText';

export interface VerseRange {
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

export type ReferenceTextError =
  'bookNotInText' | 'noRange' | 'fetchFailed' | 'empty';

export type PassagePlan =
  | { status: 'none' }
  | { status: 'error'; referenceText: ReferenceText; error: ReferenceTextError }
  | {
      status: 'fetch';
      referenceText: ReferenceText;
      /** USFM code, which HelloAO uses as its book id. */
      book: string;
      range: VerseRange;
    };

/** What to fetch for a passage from a Reference Text, or why there is nothing to fetch. */
export const planPassage = (
  passage: PassageD | undefined,
  referenceText: ReferenceText | undefined
): PassagePlan => {
  const attr = passage?.attributes;
  if (!attr || !referenceText) return { status: 'none' };
  if (passageTypeFromRef(attr.reference) !== PassageTypeEnum.PASSAGE)
    return { status: 'none' };
  if (!hasBook(referenceText, attr.book))
    return { status: 'error', referenceText, error: 'bookNotInText' };
  // parseRef keeps chapter fields that are already set, which can be stale
  // after the reference is edited, so parse a copy with them cleared
  const parsed = {
    ...passage,
    attributes: { ...attr, startChapter: undefined },
  } as PassageD;
  parseRef(parsed);
  const range: VerseRange = {
    startChapter: parsed.attributes.startChapter ?? 0,
    startVerse: parsed.attributes.startVerse ?? 0,
    endChapter: parsed.attributes.endChapter ?? 0,
    endVerse: parsed.attributes.endVerse ?? 0,
  };
  // parseRef gives chapter 0 for a reference without `ch:v`, such as `3`
  if (!range.startChapter || !range.startVerse)
    return { status: 'error', referenceText, error: 'noRange' };
  return { status: 'fetch', referenceText, book: attr.book, range };
};

export const chaptersInRange = ({ startChapter, endChapter }: VerseRange) =>
  Array.from(
    { length: Math.max(0, endChapter - startChapter + 1) },
    (_, i) => startChapter + i
  );

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';

/** The chapter body of a HelloAO `{chapter}.simple.json` response; undefined for any other shape. */
export const parseChapter = (
  json: unknown
): HelloAoSimpleChapterBody | undefined => {
  const body = isRecord(json) ? json.chapter : undefined;
  if (!isRecord(body)) return undefined;
  if (typeof body.number !== 'number' || !Array.isArray(body.content))
    return undefined;
  // content items are read defensively in passageText
  return body as unknown as HelloAoSimpleChapterBody;
};

const inRange = (chapter: number, verse: number, r: VerseRange) =>
  (chapter > r.startChapter ||
    (chapter === r.startChapter && verse >= r.startVerse)) &&
  (chapter < r.endChapter || (chapter === r.endChapter && verse <= r.endVerse));

const spokenText = (
  item: HelloAoSimpleContent,
  chapter: number,
  range: VerseRange
) => {
  if (item.type === 'verse')
    return inRange(chapter, item.number, range) ? item.text : undefined;
  // A Psalm title comes before verse 1 and is read with it
  if (item.type === 'hebrew_subtitle')
    return inRange(chapter, 1, range) ? item.text : undefined;
  return undefined;
};

/**
 * Speakable text of the verses in range: headings and footnotes dropped,
 * omitted verses skipped, and whitespace collapsed to single spaces.
 * HelloAO keys a bridged verse (e.g. 3-4) by its first number only.
 */
export const passageText = (
  chapters: HelloAoSimpleChapterBody[],
  range: VerseRange
) =>
  chapters
    .flatMap((c) =>
      c.content.map((item) =>
        isRecord(item) && typeof item.text === 'string'
          ? spokenText(item, c.number, range)
          : undefined
      )
    )
    .filter((t): t is string => !!t)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
