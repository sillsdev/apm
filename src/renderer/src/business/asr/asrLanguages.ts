import { getLangTag } from 'mui-language-picker';
import asrLangData from '../../assets/asrLangs.json';
import { AsrLangData } from '../../model/asrLang';

const { entries } = asrLangData as AsrLangData;

export const asrLanguageIsos = new Set(
  entries.map((entry) => entry.language_iso)
);

const methodsByIsoScript = new Map<string, Set<string>>();
for (const entry of entries) {
  const key = `${entry.language_iso}|${entry.script}`;
  const methods = methodsByIsoScript.get(key) ?? new Set<string>();
  methods.add(entry.method);
  methodsByIsoScript.set(key, methods);
}

/** Lower rank = higher preference. Unlisted methods sort last. */
const ASR_METHOD_RANK: Record<string, number> = {
  whisper: 0,
  'w2v-bert': 1,
  'w2vec-bert': 1,
  omnilingual: 2,
  omni: 2,
};

const DEFAULT_METHOD_RANK = 100;

export const pickPreferredAsrMethod = (
  methods: string[]
): string | undefined => {
  if (!methods.length) return undefined;
  return [...methods].sort(
    (a, b) =>
      (ASR_METHOD_RANK[a] ?? DEFAULT_METHOD_RANK) -
      (ASR_METHOD_RANK[b] ?? DEFAULT_METHOD_RANK)
  )[0];
};

export const getMethodsForAsr = (iso: string, script?: string): string[] => {
  const scr = script || 'Latn';
  const exact = methodsByIsoScript.get(`${iso}|${scr}`);
  if (exact?.size) return [...exact];
  const all = new Set<string>();
  for (const [key, methods] of methodsByIsoScript) {
    if (key.startsWith(`${iso}|`)) {
      methods.forEach((m) => all.add(m));
    }
  }
  return [...all];
};

export const getPreferredAsrMethod = (
  iso: string,
  script?: string
): string | undefined => pickPreferredAsrMethod(getMethodsForAsr(iso, script));

export const isoFromBcp47 = (bcp47: string) => {
  const langTag = getLangTag(bcp47);
  let iso = langTag?.iso639_3 ?? 'und';
  if (langTag?.tag === 'zh-CN') iso = 'cmn';
  return iso;
};

export const preferredAsrMethodFromBcp47 = (bcp47: string) => {
  const langTag = getLangTag(bcp47);
  const iso = isoFromBcp47(bcp47);
  return getPreferredAsrMethod(iso, langTag?.script);
};

/** True when iso is in the bundled ASR language list. */
export function isValidAsrLanguage(iso: string): boolean {
  if (!iso || iso === 'und') return false;
  return asrLanguageIsos.has(iso);
}

/**
 * True when the primary (vernacular) language can't be transcribed directly and
 * therefore needs a sister ASR language. An unset language needs nothing; an
 * unrecognized one (iso `und`) is assumed to need a sister.
 */
export function needsSisterLanguage(primaryBcp47: string): boolean {
  if (!primaryBcp47 || primaryBcp47 === 'und') return false;
  const iso = isoFromBcp47(primaryBcp47);
  if (!iso || iso === 'und') return true;
  return !isValidAsrLanguage(iso);
}

/** Use sister BCP when the primary language is not available for ASR. */
export function resolveAsrBcp47(
  primaryBcp: string,
  sisterBcp: string | undefined
): string {
  const primaryIso = isoFromBcp47(primaryBcp);
  const needsSister = primaryIso !== 'und' && !isValidAsrLanguage(primaryIso);
  if (needsSister && sisterBcp && sisterBcp !== 'und') {
    return sisterBcp;
  }
  if (needsSister) {
    return 'und';
  }
  return primaryBcp;
}

export const asrLanguageFilter = (code: string) => {
  const langTag = getLangTag(code);
  if (['Zxxx', 'Sgnw', 'Brai'].includes(langTag?.script ?? '')) return false;
  if (langTag?.tag?.split('-')?.[0] === 'zh') return true;
  return asrLanguageIsos.has(langTag?.iso639_3 ?? 'und');
};
