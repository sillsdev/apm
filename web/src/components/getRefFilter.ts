import { BookName } from '@model/index';
import { refNumPat } from '../utils/refNumPat';

export const getRefFilter = (
  bookCode: string,
  refString: string,
  book: BookName
) => {
  if (!refString) return null;
  const match = refString.match(refNumPat);
  if (!match) return null;
  const ref = match[1];
  const colonCount = (ref.match(/:/g) ?? []).length;

  let chapterNumbers = '';
  let verseRange = '';

  if (colonCount > 1) {
    const [startRef, endRef] = ref.split('-');
    const [startChap] = startRef.split(':');
    const [endChap] = endRef.split(':');
    chapterNumbers = [startChap, endChap].join(',');
    verseRange = ref;
  } else {
    const [chap, verses] = ref.split(':');
    chapterNumbers = chap;
    verseRange = verses;
  }

  return {
    bookName: book?.short ?? bookCode,
    chapterNumbers,
    verseRange,
  };
};
