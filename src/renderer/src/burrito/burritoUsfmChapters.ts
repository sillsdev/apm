// usfm-grammar rejects a \c that is not followed by a paragraph-level marker
// (TT-7716), which breaks USX/USJ export of cross-chapter passages.
const chapterWithoutParagraph =
  /(\\c\s*\d+)[ \t]*(?:\n|$)(?!\\(?:p|m|q|s|li|pi|nb|ms|mt|cl|cd|d)\d*\b)/g;

/** Insert `\p` after every `\c N` not already followed by a paragraph or section marker. */
export const ensureParagraphAfterChapter = (usfm: string): string =>
  usfm.replace(chapterWithoutParagraph, '$1\n\\p\n');

/** The number of the last `\c N` marker in `text`, if any. */
export const lastChapterMarker = (text: string): number | undefined => {
  let last: number | undefined;
  for (const m of text.matchAll(/\\c\s*(\d+)/g)) last = Number(m[1]);
  return last;
};
