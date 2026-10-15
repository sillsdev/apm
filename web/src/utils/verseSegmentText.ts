import { refMatch } from './refMatch';

export interface VerseSegmentEdit {
  text: string;
  caret: number;
}

function chapterInForce(text: string, cursor: number): string {
  const matches = [...text.slice(0, cursor).matchAll(/\\c (\d+)/g)];
  if (matches.length === 0) return '1';
  return matches[matches.length - 1][1];
}

/** Text range that belongs to this chapter. Chapter 1 is the text before the next chapter marker. */
function chapterSpan(
  text: string,
  chapter: string
): { start: number; end: number } | undefined {
  if (chapter === '1') {
    const next = text.search(/\\c (?!1\b)\d+/);
    return { start: 0, end: next === -1 ? text.length : next };
  }
  const found = new RegExp(String.raw`\\c ${chapter}(?!\d)`).exec(text);
  if (found?.index === undefined) return undefined;
  const start = found.index + found[0].length;
  const next = text.slice(start).search(/\\c \d+/);
  return { start, end: next === -1 ? text.length : start + next };
}

function verseInSpan(
  text: string,
  span: { start: number; end: number },
  spaced: string,
  tight: string
): number {
  const slice = text.slice(span.start, span.end);
  const spacedAt = slice.indexOf(spaced);
  const tightAt = slice.indexOf(tight);
  const hits = [spacedAt, tightAt].filter((n) => n >= 0);
  if (hits.length === 0) return -1;
  return span.start + Math.min(...hits);
}

/**
 * Insert the verse tag for a segment, or return the caret of the tag that is
 * already in that chapter.
 */
export function applyVerseSegment(
  text: string,
  reference: string,
  cursor = text.length
): VerseSegmentEdit {
  const m = refMatch(reference);
  if (!reference || !m) return { text, caret: cursor };
  const chapter = m[1] as string;
  const verse = reference.substring(chapter.length + 1);
  const spaced = String.raw`\v ${verse} `;
  const tight = String.raw`\v${verse} `;
  const span = chapterSpan(text, chapter);
  const present = span ? verseInSpan(text, span, spaced, tight) : -1;
  if (present >= 0) return { text, caret: present };
  let insert = verse ? ' ' + spaced : '';
  if (chapterInForce(text, cursor) !== chapter) {
    insert = String.raw` \c ${chapter} ` + insert;
  }
  const next = text.slice(0, cursor) + insert + text.slice(cursor);
  return { text: next, caret: cursor + insert.length };
}
