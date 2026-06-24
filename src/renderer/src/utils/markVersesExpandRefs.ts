import { Passage } from '../model';
import { parseRef } from '../crud/passage';
import { refMatch } from './refMatch';

/**
 * Expand a Mark Verses table reference (a single verse or a range) into the
 * list of individual verse references it covers, e.g.
 * `1:1-3` -> ['1:1', '1:2', '1:3'].
 *
 * Extracted verbatim from PassageDetailMarkVerses `getRefs` so its behavior can
 * be unit-tested. It currently mangles several sub-verse forms — see
 * markVersesExpandRefs.test.ts for the cases that are wrong.
 *
 * @param value   the reference text (e.g. `1:2`, `1:1-3`, `1:2a`, `3:4b-c`)
 * @param book    book code, used to look up chapter lengths for cross-chapter ranges
 * @param engVrs  map of book code -> verse counts per chapter
 */
export const expandMarkVersesRefs = (
  value: string,
  book: string,
  engVrs: Map<string, number[]>
): string[] => {
  const refs: string[] = [];
  const psg = { attributes: { reference: value } } as Passage;
  parseRef(psg);
  const { startChapter, startVerse, endChapter, endVerse } = psg.attributes;
  const match = refMatch(psg.attributes.reference);
  let firstVerse = startVerse ?? 1;
  if (match && `${firstVerse}` !== match[2]) {
    firstVerse += 1;
    refs.push(`${startChapter}:${match[2]}`);
  }
  if (startChapter === endChapter) {
    for (let i = firstVerse; i < (endVerse ?? firstVerse ?? 1); i++) {
      refs.push(`${startChapter}:${i}`);
    }
    if (match) refs.push(`${endChapter}:${match[3] || match[2]}`);
  } else {
    const endChap1 = (engVrs.get(book) ?? [])[
      (startChapter ?? 1) - 1
    ] as number;
    for (let i = firstVerse; i <= endChap1; i++) {
      refs.push(`${startChapter}:${i}`);
    }
    for (let i = 1; i < (endVerse ?? 1); i++) {
      refs.push(`${endChapter}:${i}`);
    }
    if (match) refs.push(`${endChapter}:${match[4]}`);
  }
  return refs;
};
