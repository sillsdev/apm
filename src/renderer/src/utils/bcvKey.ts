import { chOffset } from '../model';

export const bcvKey = (
  book: number,
  chapter: number,
  verse: number
): string => {
  return `${String.fromCharCode(book + chOffset)}${String.fromCharCode(
    chapter + chOffset
  )}${String.fromCharCode(verse + chOffset)}`;
};
