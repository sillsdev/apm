import { useState, useEffect } from 'react';
import codeNum from '../assets/code-num.json';

type CodeNum = [string, number][];

export const useBookN = () => {
  const [bookCodes, setBookCodes] = useState<Map<string, number>>();

  useEffect(() => {
    setBookCodes(new Map(codeNum as CodeNum));
  }, []);

  return (book: string) =>
    (bookCodes ?? new Map(codeNum as CodeNum)).get(book) ?? 0;
};
