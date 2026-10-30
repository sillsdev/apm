// Shape of https://bible.helloao.org/api/{translationId}/books.json

import { HelloAoTranslationInfo } from './helloAoBibles';

export interface HelloAoChapterReference {
  translationId: string;
  book: string; // USFM book id, e.g. GEN
  chapter: number;
}

// Book as embedded in complete(.simple).json
export interface HelloAoBookInfo {
  id: string; // USFM book id, e.g. GEN
  name: string;
  commonName: string;
  shortName?: string;
  title: string;
  order: number;
  numberOfChapters: number;
  totalNumberOfVerses: number;
  isApocryphal?: boolean; // only present (true) on apocryphal books
}

export interface HelloAoBook extends HelloAoBookInfo {
  translationId: string;
  sha256: string;
  firstChapterNumber: number;
  firstChapterApiLink: string; // relative, e.g. /api/BSB/GEN/1.json
  firstChapterReference: HelloAoChapterReference;
  lastChapterNumber: number;
  lastChapterApiLink: string;
  lastChapterReference: HelloAoChapterReference;
}

export interface HelloAoBooks {
  translation: HelloAoTranslationInfo;
  books: HelloAoBook[];
}
