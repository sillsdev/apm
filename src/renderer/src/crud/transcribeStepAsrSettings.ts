import { IAsrState } from '../business/asr/AsrAlphabet';
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
    return Boolean(orgLang?.bcp47 && orgLang.bcp47 !== 'und');
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
  return Boolean(bcp47 && bcp47 !== 'und');
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
    const orgAsr = getOrgDefault(orgDefaultAsr, orgId) as IAsrState | undefined;
    if (orgAsr?.mmsIso && orgAsr.mmsIso !== 'und') return false;
  }
  let primaryBcp: string;
  if (artifactUsesOrgVernacularLanguage(slug)) {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    primaryBcp = orgLang?.bcp47 ?? 'und';
  } else {
    const { bcp47 } = parseStepLanguageField(settings.language);
    if (!bcp47 || bcp47 === 'und') return false;
    primaryBcp = bcp47;
  }
  const iso = isoFromBcp47(primaryBcp);
  if (iso === 'und' || isValidAsrLanguage(iso)) return false;
  const sisterBcp = sisterBcpFromSettings(settings);
  return !sisterBcp || sisterBcp === 'und';
}

function stepPhoneticIsSet(settings: TranscribeStepSettings): boolean {
  return (
    settings?.phonetic === true ||
    settings?.phonetic === 'true' ||
    settings?.phonetic === false ||
    settings?.phonetic === 'false'
  );
}

export function buildVernacularAsrState(
  settings: TranscribeStepSettings,
  getOrgDefault: GetOrgDefaultFn,
  orgId: string | undefined,
  asrDefault: IAsrState
): IAsrState {
  const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
    | ILanguage
    | undefined;
  const orgAsr = getOrgDefault(orgDefaultAsr, orgId) as IAsrState | undefined;
  const sister = parseStepLanguageField(settings?.sisterlanguage);
  const sisterBcp = sister.bcp47;
  const hasStepSister = Boolean(sisterBcp && sisterBcp !== 'und');

  // Retell, Q&A, and synced Vernacular store the resolved ASR language in org ASR.
  if (orgAsr?.mmsIso && orgAsr.mmsIso !== 'und' && !hasStepSister) {
    const target = stepPhoneticIsSet(settings)
      ? asrTargetFromSettings(settings)
      : orgAsr.target;
    return {
      ...orgAsr,
      target,
      method: orgAsr.method ?? getPreferredAsrMethod(orgAsr.mmsIso),
      language: {
        ...orgAsr.language,
        font: orgLang?.font ?? orgAsr.language.font ?? asrDefault.language.font,
        rtl: orgLang?.rtl ?? orgAsr.language.rtl ?? asrDefault.language.rtl,
      },
    };
  }

  const vernacular = orgLang ?? asrDefault.language;
  const vernacularBcp = vernacular.bcp47 ?? 'und';
  const asrBcp = resolveAsrBcp47(vernacularBcp, sisterBcp);
  const langTag = getLangTag(asrBcp);
  const mmsIso = isoFromBcp47(asrBcp);
  return {
    ...asrDefault,
    target: stepPhoneticIsSet(settings)
      ? asrTargetFromSettings(settings)
      : (orgAsr?.target ?? asrDefault.target),
    mmsIso,
    method: getPreferredAsrMethod(mmsIso, langTag?.script),
    language: {
      ...asrDefault.language,
      languageName:
        asrBcp === sisterBcp && sisterBcp && sisterBcp !== 'und'
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
  asrDefault: IAsrState
): IAsrState {
  if (!settings?.artifactTypeId) return asrDefault;
  const slug = artifactTypeSlugFromSettings(settings, slugFromId);
  if (artifactUsesOrgVernacularLanguage(slug)) {
    return buildVernacularAsrState(settings, getOrgDefault, orgId, asrDefault);
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
  const mmsIso = isoFromBcp47(asrBcp);
  return {
    ...asrDefault,
    target: asrTargetFromSettings(settings),
    mmsIso,
    method: getPreferredAsrMethod(mmsIso, asrLangTag?.script),
    language: {
      ...asrDefault.language,
      languageName:
        asrBcp !== bcp47 && sisterBcp && sisterBcp !== 'und'
          ? sister.languageName
          : languageName,
      bcp47: asrBcp,
      font,
      rtl,
    },
  };
}
