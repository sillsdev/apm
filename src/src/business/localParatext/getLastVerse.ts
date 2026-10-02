import chapVrs from '../../assets/eng-vrs';

export const getLastVerse = (book: string, chap: number) => {
  const chapVrsData = new Map(chapVrs as [string, number[]][]);
  const chap1Vrs = chapVrsData.get(book);
  if (chap1Vrs) return chap1Vrs[chap - 1];
  return null;
};
