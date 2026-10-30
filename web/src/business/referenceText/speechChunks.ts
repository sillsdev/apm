// Chrome stops some voices after about 15 seconds of one utterance.
const MAX_CHUNK = 200;

const sentences = (text: string, lang: string) => {
  try {
    const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  } catch {
    return [text];
  }
};

// Splits at the last space within the limit, or at the limit when there is none.
const splitLong = (sentence: string, max: number) => {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const space = rest.lastIndexOf(' ', max - 1);
    const cut = space > 0 ? space + 1 : max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
};

/**
 * Text cut into utterances of at most `max` characters, at sentence breaks
 * where possible. Nothing is dropped, so chunk lengths add up to the text.
 */
export const speechChunks = (text: string, lang: string, max = MAX_CHUNK) => {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  let current = '';
  for (const part of sentences(text, lang).flatMap((s) => splitLong(s, max))) {
    if (current && current.length + part.length > max) {
      chunks.push(current);
      current = '';
    }
    current += part;
  }
  if (current) chunks.push(current);
  return chunks;
};
