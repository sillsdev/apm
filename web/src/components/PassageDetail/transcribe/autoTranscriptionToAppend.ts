import { VERSE_NUMBER_PATTERN } from '../../../utils/verseNumberPattern';

/**
 * ASR stream text with timestamp prefixes removed (e.g. 0:01.200: / 1:02.300: ).
 * {1,10} keeps this unanchored replace linear. (?<!\d) stops a longer digit
 * run from matching at a suffix and leaving a stray digit.
 */
export function cleanAsrTranscription(asrTrans: string): string {
  return asrTrans.replace(/(?<!\d)\d{1,10}:\d{1,10}\.\d{1,10}: /g, '').trim();
}

/**
 * Text to add from an ASR result, or undefined when curTrans already has it.
 * Skips a leading verse marker already in the pane (space or newline after
 * the number both count).
 */
export function autoTranscriptionToAppend(
  asrTrans: string,
  curTrans: string
): string | undefined {
  const cleanTrans = cleanAsrTranscription(asrTrans);
  if (!cleanTrans) return undefined;
  if (curTrans.includes(cleanTrans)) return undefined;
  // Match ranges/suffixes (1-5, 1a) so a pre-inserted \v 1-5 is not
  // treated as \v 1 and left as a stray "-5" in the pane. Trailing
  // whitespace is not part of the match so a pane newline still hits.
  const verseMarker = new RegExp(
    String.raw`^\\v (${VERSE_NUMBER_PATTERN})`
  ).exec(cleanTrans);
  let index = 0;
  //see if the current transcription already has the verse marker, if so, skip the insert.
  if (verseMarker) {
    const marker = verseMarker[0];
    const number = verseMarker[1];
    // number is only digits / a-f / hyphen from VERSE_NUMBER_PATTERN.
    const inPane = new RegExp(String.raw`\\v ${number}(?:\s|$)`).test(curTrans);
    if (inPane) {
      index = marker.length;
      index += /^\s*/.exec(cleanTrans.slice(index))?.[0].length ?? 0;
    }
  }
  const space = /\s$/.test(curTrans) ? '' : ' ';
  return space + cleanTrans.substring(index);
}
