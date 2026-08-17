/** BCP47 / ISO 639 code for an undetermined (unset) language. */
export const undLang = 'und';

/**
 * True when a language code (BCP47 or ISO 639) is set: defined, non-empty, and
 * not the "undetermined" placeholder. Replaces the repeated
 * `code && code !== 'und'` / `code !== undefined && code !== 'und'` checks.
 */
export const isLangSet = (code: string | undefined | null): code is string =>
  !!code && code !== undLang;
