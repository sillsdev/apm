import { VERSE_NUMBER_PATTERN } from './verseNumberPattern';

/** A whole verse marker (\v 1, \v 1-5, \v 1-5a) and the space after it. */
const VERSE_MARKER = new RegExp(
  String.raw`\\v\s*(?:${VERSE_NUMBER_PATTERN})(?![\w-])\s*`,
  'g'
);

export const ignoreVs = (
  s: string | undefined | null
): string | undefined | null => s?.replace(VERSE_MARKER, '');
