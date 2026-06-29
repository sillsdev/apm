import { IAsrState, normalizeAsrState } from '../business/asr/asrState';
import { AsrTarget } from '../business/asr/AsrTarget';
import { ILanguage } from '../control';
import { getLangTag } from 'mui-language-picker';
import {
  getPreferredAsrMethod,
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
      | ILanguage
      | undefined;
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

/** True when step language is set but ASR needs a sister language. */
export function transcribeSettingsNeedSisterLanguage(
  settings: TranscribeStepSettings,
  slugFromId: SlugFromIdFn,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined
): boolean {
  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  if (slug === ArtifactTypeSlug.QandA || slug === ArtifactTypeSlug.Retell) {
    const orgAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
    if (isLangSet(orgAsr?.asrIso)) return false;
  }
  let primaryBcp: string;
  if (artifactUsesOrgVernacularLanguage(slug)) {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    primaryBcp = orgLang?.bcp47 ?? 'und';
  } else {
    const { bcp47 } = parseStepLanguageField(settings.language);
    if (!isLangSet(bcp47)) return false;
    primaryBcp = bcp47;
  }
  const iso = isoFromBcp47(primaryBcp);
  if (!isLangSet(iso) || isValidAsrLanguage(iso)) return false;
  const sisterBcp = sisterBcpFromSettings(settings);
  return !isLangSet(sisterBcp);
}

function stepPhoneticIsSet(settings: TranscribeStepSettings): boolean {
  return (
    settings?.phonetic === true ||
    settings?.phonetic === 'true' ||
    settings?.phonetic === false ||
    settings?.phonetic === 'false'
  );
}

/** The persisted transliterate (Romanize) choice for the step's sister ASR. */
function stepSelectRoman(settings: TranscribeStepSettings): boolean {
  return settings?.selectRoman === true || settings?.selectRoman === 'true';
}

export function buildVernacularAsrState(
  settings: TranscribeStepSettings,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage
): IAsrState {
  const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
    | ILanguage
    | undefined;
  const orgAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
  const sister = parseStepLanguageField(settings?.sisterlanguage);

  // The step settings (sister language and the synced org ASR) were configured
  // for the org default vernacular language. When the project's vernacular
  // matches it, default to those step settings. When it differs, the saved
  // config doesn't apply, so transcribe in the project language instead (and
  // drop the org-default-based sister / transliterate choice).
  const orgBcp = orgLang?.bcp47 ?? 'und';
  const projBcp = projectLang?.bcp47 ?? 'und';
  const useProjectLang = isLangSet(projBcp) && projBcp !== orgBcp;

  const sisterBcp = useProjectLang ? 'und' : sister.bcp47;
  const hasStepSister = isLangSet(sisterBcp);

  // Retell, Q&A, and synced Vernacular store the resolved ASR language in org ASR.
  if (!useProjectLang && isLangSet(orgAsr?.asrIso) && !hasStepSister) {
    const target = stepPhoneticIsSet(settings)
      ? asrTargetFromSettings(settings)
      : orgAsr.target;
    // Transliterate defaults to false and is only valid for script transcription.
    const selectRoman =
      target === AsrTarget.alphabet && stepSelectRoman(settings);
    return {
      ...orgAsr,
      target,
      selectRoman,
      method: orgAsr.method ?? getPreferredAsrMethod(orgAsr.asrIso),
      language: {
        ...orgAsr.language,
        font: orgLang?.font ?? orgAsr.language.font ?? asrDefault.language.font,
        rtl: orgLang?.rtl ?? orgAsr.language.rtl ?? asrDefault.language.rtl,
      },
    };
  }

  const vernacular = useProjectLang
    ? projectLang!
    : (orgLang ?? asrDefault.language);
  const vernacularBcp = vernacular.bcp47 ?? 'und';
  const asrBcp = resolveAsrBcp47(vernacularBcp, sisterBcp);
  const langTag = getLangTag(asrBcp);
  const asrIso = isoFromBcp47(asrBcp);
  const target = stepPhoneticIsSet(settings)
    ? asrTargetFromSettings(settings)
    : (orgAsr?.target ?? asrDefault.target);
  return {
    ...asrDefault,
    target,
    asrIso,
    // Transliterate defaults to false and is only valid for script transcription.
    selectRoman:
      !useProjectLang &&
      target === AsrTarget.alphabet &&
      stepSelectRoman(settings),
    method: getPreferredAsrMethod(asrIso, langTag?.script),
    language: {
      ...asrDefault.language,
      languageName:
        asrBcp === sisterBcp && isLangSet(sisterBcp)
          ? sister.languageName
          : (vernacular.languageName ?? ''),
      bcp47: asrBcp,
      font: vernacular.font ?? asrDefault.language.font,
      rtl: vernacular.rtl ?? asrDefault.language.rtl,
    },
  };
}

export function buildWorkflowAsrStateFromSettings(
  settings: TranscribeStepSettings,
  slugFromId: SlugFromIdFn,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage
): IAsrState {
  if (!settings?.artifactTypeId) return asrDefault;
  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  if (artifactUsesOrgVernacularLanguage(slug)) {
    return buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang
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
  const asrBcp = resolveAsrBcp47(bcp47, sisterBcp);
  const asrLangTag = getLangTag(asrBcp);
  const asrIso = isoFromBcp47(asrBcp);
  const target = asrTargetFromSettings(settings);
  return {
    ...asrDefault,
    target,
    asrIso,
    // Transliterate defaults to false and is only valid for script transcription.
    selectRoman: target === AsrTarget.alphabet && stepSelectRoman(settings),
    method: getPreferredAsrMethod(asrIso, asrLangTag?.script),
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
