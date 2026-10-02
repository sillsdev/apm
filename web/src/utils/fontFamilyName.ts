import { getFamily } from 'mui-language-picker';

export const fontFamilyName = (font: string): string => {
  return getFamily(font)?.family ?? font;
};
