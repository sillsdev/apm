// Shapes of https://bible.helloao.org/api/{translationId}/complete.json
// and https://bible.helloao.org/api/{translationId}/complete.simple.json

import { HelloAoTranslationInfo } from './helloAoBibles';
import { HelloAoBookInfo } from './helloAoBooks';
import {
  HelloAoAudioTimings,
  HelloAoChapterCore,
  HelloAoFullChapterBody,
  HelloAoSimpleChapterBody,
} from './helloAoChapter';

export interface HelloAoCompleteChapter<
  TBody,
> extends HelloAoChapterCore<TBody> {
  // keyed by reader; the timings inline rather than links to them
  thisChapterAudioTimings: Record<string, HelloAoAudioTimings['verses']>;
}

export interface HelloAoCompleteBook<TBody> extends HelloAoBookInfo {
  chapters: HelloAoCompleteChapter<TBody>[];
}

interface HelloAoCompleteOf<TBody> {
  translation: HelloAoTranslationInfo;
  books: HelloAoCompleteBook<TBody>[];
}

export type HelloAoComplete = HelloAoCompleteOf<HelloAoFullChapterBody>;

export type HelloAoCompleteSimple = HelloAoCompleteOf<HelloAoSimpleChapterBody>;
