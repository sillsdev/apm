// Shapes of https://bible.helloao.org/api/{translationId}/{bookId}/{chapter}.json,
// .../{chapter}.simple.json and .../{chapter}.{reader}.audioTimings.json,
// plus the chapter content they share with complete(.simple).json

import { HelloAoTranslationInfo } from './helloAoBibles';
import { HelloAoBook, HelloAoChapterReference } from './helloAoBooks';

// Inline items inside full verse / hebrew_subtitle content

export interface HelloAoFormattedText {
  text: string;
  poem?: number; // indent level
  wordsOfJesus?: boolean;
  descriptive?: boolean;
}

export interface HelloAoInlineLineBreak {
  lineBreak: true;
  paragraph?: string; // USFM paragraph marker, e.g. p, m, pmo
}

export interface HelloAoFootnoteRef {
  noteId: number;
}

export type HelloAoInline =
  string | HelloAoFormattedText | HelloAoInlineLineBreak | HelloAoFootnoteRef;

// Full chapter content

export interface HelloAoHeading {
  type: 'heading';
  content: string[];
}

export interface HelloAoHebrewSubtitle {
  type: 'hebrew_subtitle';
  content: HelloAoInline[];
}

export interface HelloAoLineBreak {
  type: 'line_break';
  paragraph?: string; // USFM paragraph marker, e.g. p, m, pmo
}

export interface HelloAoVerse {
  type: 'verse';
  number: number;
  content: HelloAoInline[];
}

export type HelloAoContent =
  HelloAoHeading | HelloAoHebrewSubtitle | HelloAoLineBreak | HelloAoVerse;

interface HelloAoFootnoteBase {
  noteId: number;
  caller: string;
  text: string;
}

export interface HelloAoFootnote extends HelloAoFootnoteBase {
  reference: Pick<HelloAoChapterReference, 'chapter'> & { verse: number };
}

// Simple chapter content: inline content is flattened to text, with
// formatting and footnotes given as character offsets into that text

export interface HelloAoTextRange {
  start: number;
  end: number;
}

export interface HelloAoSimpleFootnote extends HelloAoFootnoteBase {
  offset: number;
}

type HelloAoSimplified<T> = Omit<T, 'content'> & { text: string };

interface HelloAoFootnoted {
  footnotes: HelloAoSimpleFootnote[];
}

export type HelloAoSimpleHeading = HelloAoSimplified<HelloAoHeading>;

export type HelloAoSimpleHebrewSubtitle =
  HelloAoSimplified<HelloAoHebrewSubtitle> & HelloAoFootnoted;

export type HelloAoSimpleVerse = HelloAoSimplified<HelloAoVerse> &
  HelloAoFootnoted & {
    paragraphs?: { offset: number; style: string }[];
    poem?: (HelloAoTextRange & { level: number })[];
    wordsOfJesus?: HelloAoTextRange[];
  };

export type HelloAoSimpleContent =
  | HelloAoSimpleHeading
  | HelloAoSimpleHebrewSubtitle
  | HelloAoLineBreak
  | HelloAoSimpleVerse;

// The chapter object itself

export interface HelloAoChapterBody<TContent, TFootnote> {
  number: number;
  content: TContent[];
  footnotes: TFootnote[];
}

export type HelloAoFullChapterBody = HelloAoChapterBody<
  HelloAoContent,
  HelloAoFootnote
>;

// footnotes is always empty here; footnotes live on each item
export type HelloAoSimpleChapterBody = HelloAoChapterBody<
  HelloAoSimpleContent,
  never
>;

export type HelloAoAudioLinks = Record<string, string>; // keyed by reader, e.g. david

// Fields shared by chapter responses and chapters in complete(.simple).json
export interface HelloAoChapterCore<TBody> {
  numberOfVerses: number;
  thisChapterAudioLinks: HelloAoAudioLinks;
  thisChapterWordsLink?: string;
  chapter: TBody;
}

// {chapter}.json / {chapter}.simple.json; next/previous are null at the
// first and last chapter of the translation
interface HelloAoChapterOf<TBody> extends HelloAoChapterCore<TBody> {
  translation: HelloAoTranslationInfo;
  book: HelloAoBook;
  thisChapterLink: string;
  thisChapterReference: HelloAoChapterReference;
  thisChapterAudioTimings: HelloAoAudioLinks; // links to HelloAoAudioTimings
  nextChapterApiLink: string | null;
  nextChapterReference: HelloAoChapterReference | null;
  nextChapterAudioLinks: HelloAoAudioLinks | null;
  nextChapterAudioTimings: HelloAoAudioLinks | null;
  nextChapterWordsLink?: string;
  previousChapterApiLink: string | null;
  previousChapterReference: HelloAoChapterReference | null;
  previousChapterAudioLinks: HelloAoAudioLinks | null;
  previousChapterAudioTimings: HelloAoAudioLinks | null;
  previousChapterWordsLink?: string;
}

export interface HelloAoChapter extends HelloAoChapterOf<HelloAoFullChapterBody> {
  simpleChapterApiLink: string;
}

export interface HelloAoChapterSimple extends HelloAoChapterOf<HelloAoSimpleChapterBody> {
  fullChapterApiLink: string;
}

export interface HelloAoAudioTimings {
  translationId: string;
  bookId: string;
  chapterNumber: number;
  reader: string;
  audioLink: string;
  thisChapterLink: string;
  nextChapterLink: string | null;
  previousChapterLink: string | null;
  thisChapterAudioTimingsLink: string;
  nextChapterAudioTimingsLink: string | null;
  previousChapterAudioTimingsLink: string | null;
  verses: number[]; // one timestamp in seconds per verse
}
