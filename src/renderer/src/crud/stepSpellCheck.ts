import { ArtifactTypeSlug } from './artifactTypeSlug';

export interface TranscribeStepSettingsJson {
  artifactTypeId?: string;
  language?: string;
  font?: string;
  rtl?: boolean;
  spellCheck?: boolean;
  fontSize?: string;
  namedRegion?: string;
}

/** BCP47 tag matches an Electron/Chromium spell-checker language code. */
export function hasSpellCheckerDictionary(
  bcp47: string | undefined,
  availLangs: string[] | undefined
): boolean {
  if (!bcp47 || bcp47 === 'und' || !availLangs?.length) return false;
  const tag = bcp47.toLowerCase();
  const codes = availLangs.map((c) => c.toLowerCase());
  if (codes.includes(tag)) return true;
  const primary = tag.split('-')[0];
  return codes.some((c) => c === primary || c.startsWith(`${primary}-`));
}

/** Default spell check when step settings omit `spellCheck`. */
export function defaultSpellCheckForArtifact(
  artifactTypeSlug: ArtifactTypeSlug | string | undefined,
  bcp47: string | undefined,
  availLangs?: string[]
): boolean {
  if (!artifactTypeSlug || artifactTypeSlug === ArtifactTypeSlug.Vernacular) {
    return false;
  }
  if (artifactTypeSlug === ArtifactTypeSlug.CarefulSpeech) {
    return false;
  }
  if (
    artifactTypeSlug === ArtifactTypeSlug.PhraseBackTranslation ||
    artifactTypeSlug === ArtifactTypeSlug.WholeBackTranslation
  ) {
    // When checker languages are unknown (e.g. getArtTypeFontData), default on.
    if (!availLangs?.length) return true;
    return hasSpellCheckerDictionary(bcp47, availLangs);
  }
  return false;
}

export function bcp47FromStepLanguage(language?: string): string | undefined {
  const [, tag] = language?.split('|') ?? [];
  return tag && tag !== 'und' ? tag : undefined;
}

/** Workflow step `tool.settings` is authoritative for Transcriber spell check. */
export function resolveStepSpellCheck(
  settings: TranscribeStepSettingsJson | Record<string, unknown>,
  artifactTypeSlug: ArtifactTypeSlug | string | undefined,
  bcp47: string | undefined,
  availLangs?: string[]
): boolean {
  if (settings?.spellCheck != null) {
    return !!settings.spellCheck;
  }
  return defaultSpellCheckForArtifact(artifactTypeSlug, bcp47, availLangs);
}
