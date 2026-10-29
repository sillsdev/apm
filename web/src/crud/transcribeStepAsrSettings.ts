import { IAsrState, normalizeAsrState } from '../business/asr/asrState';
import { AsrTarget } from '../business/asr/AsrTarget';
import { ILanguage } from '../control';
import { initLang } from '../control/initLang';
import { explicitAsrMethod } from '../business/asr/asrMethod';
import {
  isoFromBcp47,
  isValidAsrLanguage,
  resolveAsrBcp47,
} from '../business/asr/asrLanguages';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import { orgDefaultAsr, orgDefaultLangProps } from './useOrgDefaults';
import { isLangSet } from '../utils/langTag';

export type SlugFromIdFn = (id: string) => string;
export type GetOrgDefaultFn = (label: string, orgId?: string) => unknown;

export type TranscribeStepSettings = Record<string, unknown>;

export interface IStepLanguageInfo {
  languageName: string;
  bcp47: string;
}

const emptyStepLanguage = (): IStepLanguageInfo => ({
  languageName: '',
  bcp47: 'und',
});

/** Parses `languageName|bcp47` from step settings `language` / `sisterlanguage`. */
export function parseStepLanguageField(value: unknown): IStepLanguageInfo {
  if (value == null || value === '') return emptyStepLanguage();
  if (typeof value === 'object') {
    const obj = value as { languageName?: unknown; bcp47?: unknown };
    return {
      languageName: String(obj.languageName ?? ''),
      bcp47: String(obj.bcp47 ?? 'und'),
    };
  }
  const str = String(value);
  // Handle a JSON-serialized ILanguage object stored as a string.
  const trimmed = str.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return parseStepLanguageField(JSON.parse(trimmed));
    } catch {
      // fall through to the pipe-delimited parsing below
    }
  }
  const pipe = str.indexOf('|');
  if (pipe === -1) {
    return { languageName: '', bcp47: str || 'und' };
  }
  return {
    languageName: str.slice(0, pipe),
    bcp47: str.slice(pipe + 1) || 'und',
  };
}

export function formatStepLanguageField(lang: {
  languageName?: string;
  bcp47?: string;
}): string {
  return `${lang.languageName ?? ''}|${lang.bcp47 ?? 'und'}`;
}

export interface IStoredSisterRecommendation {
  languageName: string;
  iso: string;
  methods: string[];
  reason?: string;
}

/**
 * Cache key for sister recommendations stored on a step that has its own
 * language. The name matches the step editor; the code is the fallback when
 * the step has no name yet.
 */
export function stepSisterRecommendationKey(
  settings: TranscribeStepSettings
): string {
  const lang = parseStepLanguageField(settings.language);
  if (lang.languageName) return lang.languageName;
  return isLangSet(lang.bcp47) ? lang.bcp47 : '';
}

export function readSisterRecommendations(
  settings: TranscribeStepSettings,
  forLanguage: string
): IStoredSisterRecommendation[] | undefined {
  const raw = settings.sisterRecommendations;
  if (typeof raw !== 'string' || !forLanguage) return undefined;
  try {
    const cached = JSON.parse(raw) as {
      forLanguage?: string;
      suggestions?: IStoredSisterRecommendation[];
    };
    if (
      cached?.forLanguage !== forLanguage ||
      !Array.isArray(cached.suggestions)
    )
      return undefined;
    return cached.suggestions;
  } catch {
    return undefined;
  }
}

export function withSisterRecommendations(
  settings: TranscribeStepSettings,
  forLanguage: string,
  suggestions: IStoredSisterRecommendation[]
): TranscribeStepSettings {
  const lean = suggestions.map((s) => ({
    languageName: s.languageName,
    iso: s.iso,
    methods: s.methods,
    reason: s.reason,
  }));
  return {
    ...settings,
    sisterRecommendations: JSON.stringify({
      forLanguage,
      suggestions: lean,
    }),
  };
}

/**
 * ASR chosen on a step that does not use the vernacular. Stored on that step.
 * A missing step language is the language they picked; otherwise a different
 * language is the sister. No method means the service default; nothing else
 * is inherited, so the key is left out (an older stored "default" too).
 */
export function stepSettingsFromAsrState(
  settings: TranscribeStepSettings,
  asrState: IAsrState
): TranscribeStepSettings {
  const phonetic = asrState.target === AsrTarget.phonetic;
  const chosen = asrState.language;
  const chosenBcp = chosen?.bcp47 ?? 'und';
  const primary = parseStepLanguageField(settings.language).bcp47;
  const { asrMethod: _oldMethod, ...rest } = settings;
  const method = explicitAsrMethod(asrState.asrMethod);
  const next: TranscribeStepSettings = {
    ...rest,
    phonetic,
    selectRoman: !phonetic && asrState.selectRoman === true,
    ...(method ? { asrMethod: method } : {}),
  };
  if (!isLangSet(primary) && isLangSet(chosenBcp)) {
    next.language = formatStepLanguageField(chosen);
    return next;
  }
  next.sisterlanguage =
    isLangSet(chosenBcp) && chosenBcp !== primary
      ? formatStepLanguageField(chosen)
      : formatStepLanguageField({ languageName: '', bcp47: 'und' });
  return next;
}

export function sisterBcpFromSettings(
  settings: TranscribeStepSettings
): string {
  return parseStepLanguageField(settings.sisterlanguage).bcp47;
}

/** Phonetic and script transcription are mutually exclusive ASR targets. */
export function asrTargetFromSettings(
  settings: TranscribeStepSettings
): AsrTarget {
  return settings?.phonetic === true || settings?.phonetic === 'true'
    ? AsrTarget.phonetic
    : AsrTarget.alphabet;
}

export function artifactTypeSlugFromSettings(
  settings: TranscribeStepSettings,
  slugFromId: SlugFromIdFn
): ArtifactTypeSlug {
  if (!settings?.artifactTypeId) return ArtifactTypeSlug.Vernacular;
  return slugFromId(String(settings.artifactTypeId)) as ArtifactTypeSlug;
}

/** Artifacts whose Transcribe step names its own language. */
export const stepLanguageArtifactSlugs: readonly string[] = [
  ArtifactTypeSlug.WholeBackTranslation,
  ArtifactTypeSlug.PhraseBackTranslation,
  ArtifactTypeSlug.CarefulSpeech,
];

/**
 * Whether the step editor shows a language, and so the ASR settings for it:
 * the team language on Vernacular, or the step's own language. Q&A and Retell
 * use the team's, set on the Vernacular step, so they show neither.
 */
export function stepEditorShowsLanguage(slug: string): boolean {
  return (
    slug === ArtifactTypeSlug.Vernacular ||
    stepLanguageArtifactSlugs.includes(slug)
  );
}

/** Vernacular, Q&A, and Retell transcribe steps use org vernacular language settings. */
export function artifactUsesOrgVernacularLanguage(
  slug: ArtifactTypeSlug
): boolean {
  return (
    slug === ArtifactTypeSlug.Vernacular ||
    slug === ArtifactTypeSlug.QandA ||
    slug === ArtifactTypeSlug.Retell
  );
}

export function hasTranscribeStepLanguageSettings(
  tool: string | undefined,
  settings: TranscribeStepSettings,
  slugFromId: SlugFromIdFn,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined
): boolean {
  const hasOrgVernacular = () => {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
    return isLangSet(orgLang?.bcp47);
  };

  if (tool === ToolSlug.Transcribe && !settings?.artifactTypeId) {
    return hasOrgVernacular();
  }

  if (!settings?.artifactTypeId) {
    return false;
  }

  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  if (artifactUsesOrgVernacularLanguage(slug)) {
    return hasOrgVernacular();
  }

  const { bcp47 } = parseStepLanguageField(settings.language);
  return isLangSet(bcp47);
}

/** True when the step's language can't be transcribed and no sister is chosen. */
export async function transcribeSettingsNeedSisterLanguage(
  settings: TranscribeStepSettings,
  slugFromId: SlugFromIdFn,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  token?: string | null
): Promise<boolean> {
  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  let primaryBcp: string;
  let sisterBcp: string;
  if (artifactUsesOrgVernacularLanguage(slug)) {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
    primaryBcp = orgLang?.bcp47 ?? 'und';
    // The team's saved ASR language is the sister when it isn't the team language.
    const saved = teamVernacularAsr(getOrgDefault, orgId, settings);
    const savedBcp = saved?.language?.bcp47 ?? 'und';
    sisterBcp = savedBcp !== primaryBcp ? savedBcp : 'und';
  } else {
    primaryBcp = parseStepLanguageField(settings.language).bcp47;
    sisterBcp = sisterBcpFromSettings(settings);
  }
  if (!isLangSet(primaryBcp) || isLangSet(sisterBcp)) return false;
  const iso = isoFromBcp47(primaryBcp);
  return isLangSet(iso) && !(await isValidAsrLanguage(iso, token));
}

/** The persisted transliterate (Romanize) choice. */
function stepSelectRoman(settings: TranscribeStepSettings): boolean {
  return settings?.selectRoman === true || settings?.selectRoman === 'true';
}

/**
 * ASR stored on a step: its phonetic choice, sister language (the ASR
 * language when it isn't the step's own), method, and transliterate.
 */
export function stepAsrFromSettings(
  settings: TranscribeStepSettings
): IAsrState {
  const sister = parseStepLanguageField(settings?.sisterlanguage);
  const target = asrTargetFromSettings(settings);
  return {
    target,
    language: { ...initLang, ...sister },
    asrIso: isLangSet(sister.bcp47) ? isoFromBcp47(sister.bcp47) : 'und',
    asrMethod: explicitAsrMethod(settings?.asrMethod),
    dialect: undefined,
    selectRoman: target === AsrTarget.alphabet && stepSelectRoman(settings),
  };
}

/**
 * The team's saved ASR for Vernacular, Q&A and Retell: transcription type,
 * ASR language (a sister when it isn't the team language), method and
 * transliterate. Teams saved before the team default held all of these fall
 * back to the values older builds kept on the step. Undefined when neither
 * has anything.
 */
export function teamVernacularAsr(
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  legacyStepSettings?: TranscribeStepSettings
): IAsrState | undefined {
  const teamAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
  if (teamAsr) return teamAsr;
  if (!legacyStepSettings) return undefined;
  const legacy = stepAsrFromSettings(legacyStepSettings);
  const hasAny =
    isLangSet(legacy.asrIso) ||
    legacy.asrMethod !== undefined ||
    legacy.target === AsrTarget.phonetic ||
    legacy.selectRoman === true;
  return hasAny ? legacy : undefined;
}

/**
 * ASR for Vernacular, Q&A and Retell, from the team default (see
 * teamVernacularAsr). With no saved ASR language, the team language is used
 * when the service can transcribe it, else none ('und') so the user picks one.
 * A project in another language transcribes its own language with the
 * service's default method; the team's choices were made for the team language.
 */
export async function buildVernacularAsrState(
  legacyStepSettings: TranscribeStepSettings,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage,
  token?: string | null
): Promise<IAsrState> {
  const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
    ILanguage | undefined;
  const saved = teamVernacularAsr(getOrgDefault, orgId, legacyStepSettings);
  const target = saved?.target ?? asrDefault.target;
  const orgBcp = orgLang?.bcp47 ?? 'und';
  const projBcp = projectLang?.bcp47 ?? 'und';

  if (isLangSet(projBcp) && projBcp !== orgBcp) {
    const asrBcp = await resolveAsrBcp47(projBcp, undefined, token);
    return {
      ...asrDefault,
      target,
      asrIso: isoFromBcp47(asrBcp),
      selectRoman: false,
      asrMethod: undefined,
      language: { ...asrDefault.language, ...projectLang, bcp47: asrBcp },
    };
  }

  const font =
    orgLang?.font ?? saved?.language?.font ?? asrDefault.language.font;
  const rtl = orgLang?.rtl ?? saved?.language?.rtl ?? asrDefault.language.rtl;
  if (saved && isLangSet(saved.asrIso)) {
    return { ...saved, target, language: { ...saved.language, font, rtl } };
  }

  const asrBcp = await resolveAsrBcp47(orgBcp, undefined, token);
  return {
    ...asrDefault,
    target,
    asrIso: isoFromBcp47(asrBcp),
    selectRoman: target === AsrTarget.alphabet && saved?.selectRoman === true,
    asrMethod: saved?.asrMethod,
    language: {
      ...asrDefault.language,
      languageName: orgLang?.languageName ?? '',
      bcp47: asrBcp,
      font,
      rtl,
    },
  };
}

export interface WorkflowAsrStateOptions {
  settings: TranscribeStepSettings;
  slugFromId: SlugFromIdFn;
  getOrgDefault: GetOrgDefaultFn;
  orgId: string | undefined;
  asrDefault: IAsrState;
  projectLang?: ILanguage;
  token?: string | null;
}

export async function buildWorkflowAsrStateFromSettings({
  settings,
  slugFromId,
  getOrgDefault,
  orgId,
  asrDefault,
  projectLang,
  token,
}: WorkflowAsrStateOptions): Promise<IAsrState> {
  if (!settings?.artifactTypeId) return asrDefault;
  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  if (artifactUsesOrgVernacularLanguage(slug)) {
    return buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang,
      token
    );
  }
  const { languageName, bcp47 } = parseStepLanguageField(settings?.language);
  const font = String(settings?.font ?? asrDefault.language.font);
  const rtl =
    settings?.rtl === true ||
    settings?.rtl === 'true' ||
    asrDefault.language.rtl;
  const sister = parseStepLanguageField(settings?.sisterlanguage);
  const sisterBcp = sister.bcp47;
  const asrBcp = await resolveAsrBcp47(bcp47, sisterBcp, token);
  const asrIso = isoFromBcp47(asrBcp);
  const target = asrTargetFromSettings(settings);
  return {
    ...asrDefault,
    target,
    asrIso,
    // Transliterate defaults to false and is only valid for script transcription.
    selectRoman: target === AsrTarget.alphabet && stepSelectRoman(settings),
    asrMethod: explicitAsrMethod(settings?.asrMethod),
    language: {
      ...asrDefault.language,
      languageName:
        asrBcp !== bcp47 && isLangSet(sisterBcp)
          ? sister.languageName
          : languageName,
      bcp47: asrBcp,
      font,
      rtl,
    },
  };
}
