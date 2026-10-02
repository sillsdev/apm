import type { Localization } from '@mui/x-data-grid/internals';
import {
  enUS,
  esES,
  frFR,
  idID,
  ptBR,
  ruRU,
  zhCN,
} from '@mui/x-data-grid/locales';

/**
 * Maps UI language codes to MUI x-data-grid localization objects
 * Supported languages: en, es, fr, id, pt, ru, zh
 */
export const getDataGridLocale = (lang: string): Localization => {
  const localeMap: Record<string, Localization> = {
    en: enUS,
    es: esES,
    fr: frFR,
    id: idID,
    pt: ptBR,
    ru: ruRU,
    zh: zhCN,
  };

  return localeMap[lang] || enUS;
};
