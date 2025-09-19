import { useUiLang } from '../crud/useUiLang';
import { langName } from '../utils';
import type { UiLoc } from '../utils/langName';

export const useLocLangName = (): [typeof getName, typeof compare] => {
  const getUiLang = useUiLang();

  const getUiName = (bcp47: string, ui: UiLoc): string => {
    const res = langName(ui, bcp47) || langName(ui, bcp47.replace('-', '_'));
    if (res) return res;
    const items = bcp47.split('-').slice(0, -1);
    return langName(ui, items.join('_'));
  };

  const getName = (bcp47: string): string => {
    return getUiName(bcp47, getUiLang() as UiLoc) || getUiName(bcp47, 'en');
  };

  const compare = (x: string, y: string): number => {
    return getName(x) < getName(y) ? -1 : 1;
  };

  return [getName, compare] as [typeof getName, typeof compare];
};
