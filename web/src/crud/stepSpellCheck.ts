import { ArtifactTypeSlug } from './artifactTypeSlug';
import type { TranscribeStepSettings } from './transcribeStepSettings';

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
export function isSpellCheckOnByDefault(
  artifactTypeSlug: ArtifactTypeSlug | string | undefined,
  _bcp47?: string,
  _availLangs?: string[]
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
    // Match Web and offline workflow seeding: PBT/WBT default on.
    // Dictionary availability should not hide the step checkbox on Desktop.
    return true;
  }
  return false;
}

/** Workflow step `tool.settings` is authoritative for Transcriber spell check. */
export function isStepSpellCheckOn(
  settings: TranscribeStepSettings,
  artifactTypeSlug: ArtifactTypeSlug | string | undefined,
  bcp47: string | undefined,
  availLangs?: string[]
): boolean {
  if (settings.spellCheck !== undefined) return settings.spellCheck;
  return isSpellCheckOnByDefault(artifactTypeSlug, bcp47, availLangs);
}
