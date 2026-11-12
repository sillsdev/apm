// usfm-grammar rejects a \c that is not followed by a paragraph-level marker
// (TT-7716), which breaks USX/USJ export of cross-chapter passages. The \c may
// be on its own line (typed) or inline, as Paratext text import produces
// (`…\v 27 End\c 2 \v 1 Start…`).
const chapterWithoutParagraph =
  /(\n)?[ \t]*(\\c[ \t]*\d+)(?:[ \t]*(?:\n|$)|[ \t]+|(?=\\))(?!\\(?:p|m|q|s|li|pi|nb|ms|mt|cl|cd|d)\d*\b)/g;

/**
 * Put every `\c N` on its own line followed by `\p`, unless a paragraph or
 * section marker already follows it. CRLF is normalized to LF first so the
 * pattern sees one line-break form; a lone `\r` (Paratext's in-verse paragraph
 * break) is kept.
 */
export const ensureParagraphAfterChapter = (usfm: string): string =>
  usfm
    .replace(/\r\n/g, '\n')
    .replace(
      chapterWithoutParagraph,
      (_m, _nl, chapter: string, offset) =>
        `${offset === 0 ? '' : '\n'}${chapter}\n\\p\n`
    );

/** The number of the last `\c N` marker in `text`, if any. */
export const lastChapterMarker = (text: string): number | undefined => {
  let last: number | undefined;
  for (const m of text.matchAll(/\\c\s*(\d+)/g)) last = Number(m[1]);
  return last;
};
