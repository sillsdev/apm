import {
  resolveSelection,
  type TextSelection,
} from '../../../utils/insertAtCursor';
import { VERSE_NUMBER_PATTERN } from '../../../utils/verseNumberPattern';

/** Where ASR text goes: replace the pane, add at the end, or at the caret. */
export type AsrTextMode = 'replace' | 'end' | 'cursor';

/** The pane's new value and the caret after the change. */
export interface AsrTextEdit {
  value: string;
  caret: number;
}

/**
 * Put ASR text into the pane at the caret (or over the selection), with a
 * space between it and any word on either side. An unplaced caret puts it at
 * the end (see resolveSelection).
 */
export function insertAsrText(
  current: string,
  text: string,
  selection: TextSelection
): AsrTextEdit {
  const { start, end } = resolveSelection(current.length, selection);
  const before = current.slice(0, start);
  const after = current.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^\s/.test(after) ? ' ' : '';
  return {
    value: before + lead + text + trail + after,
    caret: before.length + lead.length + text.length,
  };
}

/** A verse marker in ASR text; group 1 is the verse number. */
const ASR_MARKER = new RegExp(
  String.raw`\\v (${VERSE_NUMBER_PATTERN})(?![\w-])`,
  'g'
);

/** ASR text split at its verse markers: text before any marker, then each verse. */
function verseParts(text: string): {
  lead: string;
  verses: { verse: string; words: string; part: string }[];
} {
  const hits = [...text.matchAll(ASR_MARKER)];
  const verses = hits.map((hit, ix) => {
    const from = hit.index;
    const to = hits[ix + 1]?.index ?? text.length;
    const part = text.slice(from, to).trim();
    return {
      verse: hit[1],
      words: text.slice(from + hit[0].length, to).trim(),
      part,
    };
  });
  return { lead: text.slice(0, hits[0]?.index ?? text.length).trim(), verses };
}

/**
 * Where words for this verse go: just after an empty `\v verse` marker in the
 * pane (only whitespace before the next marker or the end), or -1.
 */
function emptyMarkerEnd(value: string, verse: string): number {
  // verse is only digits / a-f / hyphen from VERSE_NUMBER_PATTERN.
  const marker = new RegExp(String.raw`\\v ?${verse}(?![\w-])`, 'g');
  for (const hit of value.matchAll(marker)) {
    const end = hit.index + hit[0].length;
    const rest = value.slice(end);
    const next = rest.search(/\\[vc]\s*\d/);
    const gap = next === -1 ? rest : rest.slice(0, next);
    if (!gap.trim()) return end;
  }
  return -1;
}

/**
 * Insert ASR text at the caret, but put each `\v N words` part after an empty
 * `\v N` already in the pane instead of adding a second marker (TT-7856).
 * Parts with no empty marker go at the caret, as insertAsrText does.
 */
export function insertAsrVerses(
  current: string,
  text: string,
  selection: TextSelection
): AsrTextEdit {
  const { lead, verses } = verseParts(text);
  let value = current;
  let { start, end } = resolveSelection(current.length, selection);
  let caret = -1;
  const rest: string[] = lead ? [lead] : [];
  for (const { verse, words, part } of verses) {
    const at = words ? emptyMarkerEnd(value, verse) : -1;
    if (at < 0) {
      rest.push(part);
      continue;
    }
    const fill = ' ' + words;
    value = value.slice(0, at) + fill + value.slice(at);
    if (at <= start) start += fill.length;
    if (at <= end) end += fill.length;
    caret = at + fill.length;
  }
  if (rest.length > 0)
    return insertAsrText(value, rest.join(' '), { start, end });
  return { value, caret: caret < 0 ? start : caret };
}

/** Apply ASR text to the pane in the given mode; shared by desktop and mobile. */
export function applyAsrText(
  current: string,
  text: string,
  mode: AsrTextMode,
  selection: TextSelection
): AsrTextEdit {
  switch (mode) {
    case 'replace':
      return { value: text, caret: text.length };
    case 'end':
      return { value: current + text, caret: current.length + text.length };
    case 'cursor':
      return insertAsrVerses(current, text, selection);
  }
}
