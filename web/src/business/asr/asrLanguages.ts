import { getLangTag } from 'mui-language-picker';
import { axiosGet } from '../../utils/axios';
import { isLangSet } from '../../utils/langTag';

export {
  asrMethodDefaultValue,
  asrRequestMethod,
  explicitAsrMethod,
} from './asrMethod';

/**
 * Methods to list under Default. Undefined when the choice should be hidden
 * (fewer than two methods). The first entry is the one aero ranked highest.
 */
export function specificAsrMethods(
  methods: string[]
): { preferred: string; others: string[] } | undefined {
  const [preferred, ...others] = methods;
  if (!preferred || others.length === 0) return undefined;
  return { preferred, others };
}

export const isoFromBcp47 = (bcp47: string) => {
  const langTag = getLangTag(bcp47);
  let iso = langTag?.iso639_3 ?? 'und';
  if (langTag?.tag === 'zh-CN') iso = 'cmn';
  return iso;
};

// ponytail: cached for the page session. A language published after load shows up on refresh.
const asrMethodsByIso = new Map<string, string[]>();
const asrMethodsInflight = new Map<string, Promise<string[]>>();

// ponytail: one fetch per page session. Refresh to pick up a newly published language.
let asrLanguageCodes: Set<string> | undefined;
let asrLanguagesRequest: Promise<Set<string>> | undefined;

/** Test hook. Production calls fill the session caches. */
export function clearAsrLanguageValidityCache(): void {
  asrMethodsByIso.clear();
  asrMethodsInflight.clear();
  asrLanguageCodes = undefined;
  asrLanguagesRequest = undefined;
}

const stringsFrom = (data: unknown): Set<string> => {
  if (!Array.isArray(data)) return new Set();
  return new Set(
    data.filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
  );
};

/** Aero rejects every request that has no bearer token. */
const canAskAero = (token?: string | null): token is string => Boolean(token);

/** ISO 639-3 codes aero can transcribe. Asked once per page session. */
export function loadAsrLanguages(token?: string | null): Promise<Set<string>> {
  if (asrLanguageCodes) return Promise.resolve(asrLanguageCodes);
  if (asrLanguagesRequest) return asrLanguagesRequest;
  if (!canAskAero(token)) return Promise.resolve(new Set());
  const request = (async () => {
    try {
      const data = await axiosGet(
        'aero/transcription/languages',
        undefined,
        token
      );
      const codes = stringsFrom(data);
      asrLanguageCodes = codes;
      return codes;
    } catch (err) {
      asrLanguagesRequest = undefined;
      throw err;
    }
  })();
  asrLanguagesRequest = request;
  return request;
}

const notFound = (err: unknown): boolean => {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as { response?: { status?: number } }).response?.status;
  return status === 404;
};

/** Methods from aero `asrlanguages/{iso}`, already in ranked order. */
const methodsFromAsrLanguageResponse = (data: unknown): string[] => [
  ...stringsFrom(data),
];

/** Methods aero offers for this iso. Empty when the language is not supported. */
const loadAsrMethods = (
  iso: string,
  token?: string | null
): Promise<string[]> => {
  const known = asrMethodsByIso.get(iso);
  if (known) return Promise.resolve(known);
  const pending = asrMethodsInflight.get(iso);
  if (pending) return pending;
  if (!canAskAero(token)) return Promise.resolve([]);
  const request = (async () => {
    try {
      const data = await axiosGet(
        `aero/transcription/asrlanguages/${encodeURIComponent(iso)}`,
        undefined,
        token
      );
      const methods = methodsFromAsrLanguageResponse(data);
      asrMethodsByIso.set(iso, methods);
      return methods;
    } catch (err) {
      if (notFound(err)) {
        asrMethodsByIso.set(iso, []);
        return [];
      }
      throw err;
    } finally {
      asrMethodsInflight.delete(iso);
    }
  })();
  asrMethodsInflight.set(iso, request);
  return request;
};

export async function getMethodsForAsr(
  iso: string,
  token?: string | null
): Promise<string[]> {
  if (!isLangSet(iso) || !canAskAero(token)) return [];
  return loadAsrMethods(iso, token);
}

/** True when aero lists this ISO 639-3 code as an ASR language. */
export async function isValidAsrLanguage(
  iso: string,
  token?: string | null
): Promise<boolean> {
  if (!isLangSet(iso)) return false;
  // Offline: can't ask. Leaving the language in place beats marking it unsupported.
  if (!canAskAero(token)) return true;
  const methods = await loadAsrMethods(iso, token);
  return methods.length > 0;
}

/**
 * True when the primary (vernacular) language can't be transcribed directly and
 * therefore needs a sister ASR language. An unset language does not need a sister.
 */
export async function needsSisterLanguage(
  primaryBcp47: string,
  token?: string | null
): Promise<boolean> {
  if (!isLangSet(primaryBcp47) || !canAskAero(token)) return false;
  const iso = isoFromBcp47(primaryBcp47);
  if (!isLangSet(iso)) return false;
  return !(await isValidAsrLanguage(iso, token));
}

/** Use sister BCP when the primary language is not available for ASR. */
export async function resolveAsrBcp47(
  primaryBcp: string,
  sisterBcp: string | undefined,
  token?: string | null
): Promise<string> {
  // Offline (no token) aero can't say whether the primary is supported. A
  // sister is only configured when the primary needed one, so trust it.
  if (!canAskAero(token) && isLangSet(sisterBcp)) return sisterBcp;
  const primaryIso = isoFromBcp47(primaryBcp);
  const needsSister =
    isLangSet(primaryIso) && !(await isValidAsrLanguage(primaryIso, token));
  if (needsSister && isLangSet(sisterBcp)) {
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
  return asrLanguageCodes?.has(langTag?.iso639_3 ?? 'und') ?? false;
};
