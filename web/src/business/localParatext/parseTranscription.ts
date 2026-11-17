import { parseRef } from '../../crud/passage';
import { Passage } from '../../model';
import { VERSE_NUMBER_PATTERN } from '../../utils/verseNumberPattern';

export const parseTranscription = (
  currentPassage: Passage,
  transcription: string
) => {
  // Trailing \s required here; autoTranscriptionToAppend allows an optional one.
  const pattern = new RegExp(
    String.raw`(\\v\s*${VERSE_NUMBER_PATTERN}\s)`,
    'g'
  );
  const internalverses = Array.from(transcription.matchAll(pattern));
  // Get all matches
  if (internalverses.length < 1) {
    currentPassage.attributes.lastComment = transcription.trimEnd();
    return [currentPassage];
  }
  const ret: Passage[] = [];
  let start = 0;
  const chapPat = /^\\c\s*(\d+)\s/;
  internalverses.forEach((match, index) => {
    const chapIndex = match.input
      ?.slice(0, match.index)
      .lastIndexOf(String.raw`\c`);
    const chapMatch = chapPat.exec(match.input?.slice(chapIndex) ?? '');
    start = match.index! + match[0].length;
    let t =
      index < internalverses.length - 1
        ? transcription.substring(start, internalverses![index + 1].index!)
        : transcription.substring(start);
    const newChapIdx = t.indexOf(String.raw`\c`);
    if (newChapIdx > -1) {
      t = t.slice(0, newChapIdx);
    }
    let chapter: string;
    if (chapMatch) {
      chapter = chapMatch[1];
    } else if (chapIndex && chapIndex > 0) {
      chapter = (currentPassage.attributes.endChapter || 0).toString();
    } else {
      chapter = (currentPassage.attributes.startChapter || 0).toString();
    }
    ret.push({
      attributes: {
        book: currentPassage.attributes.book,
        reference:
          chapter + ':' + match[0].replaceAll(String.raw`\v`, '').trim(),
        lastComment: t.trimStart().trimEnd(),
      },
      relationships: currentPassage.relationships,
    } as Passage);
  });
  ret[0].attributes.sequencenum = currentPassage.attributes.sequencenum;
  ret.forEach((p) => parseRef(p));
  return ret;
};
