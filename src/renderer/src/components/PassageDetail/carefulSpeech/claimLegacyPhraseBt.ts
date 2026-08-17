import { related } from '../../../crud/related';
import { MediaFileD } from '../../../model';
import {
  getSegments,
  NamedRegions,
  updateSegments,
} from '../../../utils/namedSegments';
import { hasPhraseRegions } from './carefulSpeechBoundary';
import {
  formatMediaLanguageField,
  parseMediaLanguageBcp47,
  phraseBtBoundaryRegionName,
} from './matchesGuidedOutputRow';

export interface IClaimLegacyPhraseBtArgs {
  languageName: string;
  languageBcp47: string;
  artifactTypeId: string;
  /** Vernacular mediafiles that may hold a legacy BT bucket. */
  vernacularMedia: MediaFileD[];
  /** PBT (or same-artifact) mediafiles that may be untagged. */
  outputMedia: MediaFileD[];
}

export interface IClaimLegacyPhraseBtResult {
  /** mediafile id → new languagebcp47 */
  languageUpdates: Map<string, string>;
  /** vernacular mediafile id → new segments JSON */
  segmentUpdates: Map<string, string>;
}

/**
 * Claim untagged outputs and copy legacy `BT` into `BT:${bcp47}` when empty.
 * Does not touch Retell or other artifact types.
 */
export function planLegacyPhraseBtClaim(
  args: IClaimLegacyPhraseBtArgs
): IClaimLegacyPhraseBtResult {
  const langField = formatMediaLanguageField(
    args.languageName,
    args.languageBcp47
  );
  const languageUpdates = new Map<string, string>();
  const segmentUpdates = new Map<string, string>();
  const bucket = phraseBtBoundaryRegionName(args.languageBcp47);

  for (const m of args.outputMedia) {
    if (related(m, 'artifactType') !== args.artifactTypeId) continue;
    const existing = parseMediaLanguageBcp47(m.attributes?.languagebcp47);
    if (existing === 'und' || !m.attributes?.languagebcp47) {
      languageUpdates.set(m.id, langField);
    }
  }

  for (const v of args.vernacularMedia) {
    const all = v.attributes?.segments ?? '[]';
    const langBucket = getSegments(bucket, all);
    if (hasPhraseRegions(langBucket)) continue;
    const legacy = getSegments(NamedRegions.BackTranslation, all);
    if (!hasPhraseRegions(legacy)) continue;
    segmentUpdates.set(v.id, updateSegments(bucket, all, legacy));
  }

  return { languageUpdates, segmentUpdates };
}
