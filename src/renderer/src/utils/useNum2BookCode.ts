import { useState, useEffect } from 'react';
import codeNum from '../assets/code-num.json';

type CodeNum = [string, number][];

export const useNum2BookCode = () => {
  const [bookCodes, setBookCodes] = useState<Map<number, string>>();

  useEffect(() => {
    setBookCodes(
      new Map((codeNum as CodeNum).map(([book, num]) => [num, book]))
    );
  }, []);

  return (bookNum: number) =>
    (
      bookCodes ??
      new Map((codeNum as CodeNum).map(([book, num]) => [num, book]))
    ).get(bookNum);
};
