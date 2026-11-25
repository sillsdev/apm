/**
 * ASR stream text with timestamp prefixes removed (e.g. 0:01.200: / 1:02.300: ).
 * {1,10} keeps this unanchored replace linear. (?<!\d) stops a longer digit
 * run from matching at a suffix and leaving a stray digit.
 */
export function cleanAsrTranscription(asrTrans: string): string {
  return asrTrans.replace(/(?<!\d)\d{1,10}:\d{1,10}\.\d{1,10}: /g, '').trim();
}
