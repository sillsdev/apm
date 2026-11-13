/**
 * Text to append from an ASR result, or undefined when curTrans already has it.
 * Strips timestamp prefixes and skips a leading verse marker already in the pane.
 */
export function appendAutoTranscription(
  trans: string,
  curTrans: string
): string | undefined {
  // {1,10} keeps this unanchored replace linear. (?<!\d) stops a
  // longer digit run from matching at a suffix and leaving a stray digit.
  const cleanTrans = trans
    .replace(/(?<!\d)\d{1,10}:\d{1,10}\.\d{1,10}: /g, '')
    .trim();
  if (curTrans.includes(cleanTrans)) return undefined;
  // Match ranges/suffixes (1-5, 1a) so a pre-inserted \v 1-5 is not
  // treated as \v 1 and left as a stray "-5" in the pane.
  const m = /\\v (\d+[a-f]?-?\d*[a-f]?)\s?/.exec(cleanTrans);
  const index = m && curTrans.includes(m[0]) ? m[0].length : 0;
  const space = /\s$/.test(curTrans) ? '' : ' ';
  return space + cleanTrans.substring(index);
}
