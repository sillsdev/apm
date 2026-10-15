import { refMatch } from './refMatch';

export interface VerseSegmentEdit {
  text: string;
  caret: number;
}

/**
 * Chapter of the text before any chapter marker: the passage's start chapter,
 * else the chapter its reference starts in (as parseRef reads it), else the
 * chapter of its first verse segment.
 */
export function openingChapter(
  startChapter: number | undefined,
  passageReference: string | undefined,
  firstReference: string | undefined
): string {
  if (startChapter) return startChapter.toString();
  const fromReference = /^\s*(\d+):/.exec(passageReference ?? '')?.[1];
  if (fromReference && Number.parseInt(fromReference) > 0) return fromReference;
  return (firstReference && refMatch(firstReference)?.[1]) || '1';
}

function chapterInForce(text: string, cursor: number, opening: string): string {
  const matches = [...text.slice(0, cursor).matchAll(/\\c (\d+)/g)];
  if (matches.length === 0) return opening;
  return matches[matches.length - 1][1];
}

/** Text range that belongs to this chapter. The opening chapter is the text before the next chapter marker. */
function chapterSpan(
  text: string,
  chapter: string,
  opening: string
): { start: number; end: number } | undefined {
  if (chapter === opening) {
    const next = text.search(
      new RegExp(String.raw`\\c (?!${opening}(?!\d))\d+`)
    );
    return { start: 0, end: next === -1 ? text.length : next };
  }
  const found = new RegExp(String.raw`\\c ${chapter}(?!\d)`).exec(text);
  if (found?.index === undefined) return undefined;
  const start = found.index + found[0].length;
  const next = text.slice(start).search(/\\c \d+/);
  return { start, end: next === -1 ? text.length : start + next };
}

/**
 * Caret for a verse tag already in the span: the end of that verse's text,
 * before the next verse or chapter marker, so typing adds to this verse and
 * the next inserted tag follows it. An empty verse puts the caret after its tag.
 */
function verseCaretInSpan(
  text: string,
  span: { start: number; end: number },
  spaced: string,
  tight: string
): number {
  const slice = text.slice(span.start, span.end);
  const hits = [spaced, tight]
    .map((tag) => ({ at: slice.indexOf(tag), tag }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (hits.length === 0) return -1;
  const tagEnd = hits[0].at + hits[0].tag.length;
  const next = slice.slice(tagEnd).search(/\\(?:v ?|c )\d/);
  const verseEnd = next === -1 ? slice.length : tagEnd + next;
  const contentEnd = tagEnd + slice.slice(tagEnd, verseEnd).trimEnd().length;
  return span.start + contentEnd;
}

/**
 * Insert the verse tag for a segment, or return the caret at the end of the
 * text of the tag that is already in that chapter. Text before any chapter
 * marker is in the opening chapter, as parseTranscription reads it. An inserted tag replaces the
 * selected text from cursor to selectionEnd, as insertAtCursor does.
 */
export function applyVerseSegment(
  text: string,
  reference: string,
  cursor = text.length,
  opening = '1',
  selectionEnd = cursor
): VerseSegmentEdit {
  const m = refMatch(reference);
  if (!reference || !m) return { text, caret: cursor };
  const chapter = m[1] as string;
  const verse = reference.substring(chapter.length + 1);
  const spaced = String.raw`\v ${verse} `;
  const tight = String.raw`\v${verse} `;
  const span = chapterSpan(text, chapter, opening);
  const present = span ? verseCaretInSpan(text, span, spaced, tight) : -1;
  if (present >= 0) return { text, caret: present };
  let insert = verse ? ' ' + spaced : '';
  if (chapterInForce(text, cursor, opening) !== chapter) {
    insert = String.raw` \c ${chapter} ` + insert;
  }
  const next = text.slice(0, cursor) + insert + text.slice(selectionEnd);
  return { text: next, caret: cursor + insert.length };
}
