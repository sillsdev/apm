import { related } from '../../../crud/related';
import { MediaFileD } from '../../../model';
import { tryParseJSON } from '../../../utils/tryParseJson';
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

const BUCKET_PREFIX = phraseBtBoundaryRegionName('');

/**
 * True when a vernacular already carries Phrase BT boundaries for some language
 * other than `bcp47` - i.e. this passage is already being back-translated into
 * more than one language.
 */
function hasOtherLanguageBoundaries(
  vernacularMedia: MediaFileD[],
  bcp47: string
): boolean {
  const mine = phraseBtBoundaryRegionName(bcp47).toLowerCase();
  return vernacularMedia.some((v) => {
    const all = v.attributes?.segments ?? '[]';
    const parsed = tryParseJSON(all);
    if (!Array.isArray(parsed)) return false;
    return parsed.some((entry) => {
      const name = String((entry as { name?: unknown })?.name ?? '');
      const lower = name.toLowerCase();
      if (!lower.startsWith(BUCKET_PREFIX.toLowerCase())) return false;
      if (lower === mine) return false;
      return hasPhraseRegions(getSegments(name, all));
    });
  });
}

/**
 * Claim untagged outputs and copy legacy `BT` into `BT:${bcp47}` when empty.
 * Does not touch Retell or other artifact types.
 *
 * Claiming is for data recorded before takes were stamped with a language,
 * which by definition belongs to whichever single language the team was working
 * in. Once a passage has boundaries for a second language the premise is gone:
 * an untagged take could belong to either step, and handing it to whichever one
 * happened to open played one language's audio in the other's step (TT-7643).
 * So the language claim is skipped there - an unclaimed take stays out of every
 * step rather than joining the wrong one. Copying legacy boundaries into this
 * language's empty bucket is unaffected: boundaries are per language and the
 * copy never overwrites an existing bucket.
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
  const multiLanguage = hasOtherLanguageBoundaries(
    args.vernacularMedia,
    args.languageBcp47
  );

  for (const m of args.outputMedia) {
    if (multiLanguage) break;
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
