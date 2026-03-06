import codeNum from '../assets/code-num.json';

type CodeNum = [string, number][];
const bookCodesMap = new Map(codeNum as CodeNum);

export const getBookCode = (book: string) => bookCodesMap.get(book) ?? 0;

export const useBookN = () => getBookCode;
