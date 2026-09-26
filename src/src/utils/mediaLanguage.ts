import { MediaFileD } from '../model';

/**
 * Pure helpers for the `Name|bcp47` language field stamped on mediafiles and
 * on Transcribe step settings. Kept in `utils` (not under a component subtree)
 * so context-layer modules can scope media by step language without importing
 * from `components/`.
 */

/** Parse `Name|bcp47` (or bare bcp47) without pulling StepEditor/ASR deps. */
export function parseMediaLanguageField(value: unknown): {
  languageName: string;
  bcp47: string;
} {
  if (value == null || value === '') return { languageName: '', bcp47: 'und' };
  if (typeof value === 'object') {
    const obj = value as { languageName?: unknown; bcp47?: unknown };
    return {
      languageName: String(obj.languageName ?? ''),
      bcp47: String(obj.bcp47 ?? 'und') || 'und',
    };
  }
  const str = String(value).trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      return parseMediaLanguageField(JSON.parse(str));
    } catch {
      /* fall through */
    }
  }
  const pipe = str.indexOf('|');
  if (pipe === -1) return { languageName: '', bcp47: str || 'und' };
  return {
    languageName: str.slice(0, pipe),
    bcp47: str.slice(pipe + 1) || 'und',
  };
}

export function parseMediaLanguageBcp47(value: unknown): string {
  return parseMediaLanguageField(value).bcp47;
}

export function formatMediaLanguageField(
  languageName: string,
  bcp47: string
): string {
  return `${languageName}|${bcp47 || 'und'}`;
}

/** bcp47 tags are case-insensitive, so lowercase them before comparing. */
const normalizeBcp47 = (bcp47: string): string => bcp47.toLowerCase();

function mediaLanguageBcp47(mediafile: MediaFileD | undefined): string {
  return parseMediaLanguageBcp47(mediafile?.attributes?.languagebcp47);
}

/** True when step language should filter guided outputs. */
export function isLanguageFilterActive(languageBcp47?: string): boolean {
  return Boolean(languageBcp47 && normalizeBcp47(languageBcp47) !== 'und');
}

/** True when a mediafile belongs to a step scoped to `stepLanguageBcp47`. */
export function mediaMatchesStepLanguage(
  mediafile: MediaFileD | undefined,
  stepLanguageBcp47?: string
): boolean {
  if (!isLanguageFilterActive(stepLanguageBcp47)) return true;
  return (
    normalizeBcp47(mediaLanguageBcp47(mediafile)) ===
    normalizeBcp47(stepLanguageBcp47 as string)
  );
}
