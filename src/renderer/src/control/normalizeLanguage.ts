import { ILanguage } from './Language';

/**
 * Coerce a boolean that was read back from free-form JSON (org defaults, bible
 * publishing data, step tool settings). Those blobs are never schema-validated,
 * so a boolean may have been persisted as the string `'true'` / `'false'`.
 * Note `'false'` is truthy in JS, so an uncoerced value passes every `if` and
 * only fails later — e.g. orbit rejecting `project.rtl` as 'not a boolean'.
 */
export const jsonBoolean = (value: unknown, dflt = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return dflt;
};

/**
 * Coerce a persisted {@link ILanguage} read from free-form JSON so its fields
 * match their declared types. Returns undefined when nothing was stored, so
 * callers can keep falling back to their own default language.
 */
export const normalizeLanguage = (raw: unknown): ILanguage | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    ...(obj as unknown as ILanguage),
    bcp47: typeof obj.bcp47 === 'string' ? obj.bcp47 : 'und',
    languageName: typeof obj.languageName === 'string' ? obj.languageName : '',
    font: typeof obj.font === 'string' ? obj.font : '',
    rtl: jsonBoolean(obj.rtl),
    spellCheck: jsonBoolean(obj.spellCheck),
  };
};
