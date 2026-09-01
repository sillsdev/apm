import { related } from '../../../crud/related';
import { isNewerTake } from '../../../crud/latestTakePerSourceSegment';
import { IRow } from '../../../context/PassageDetailContext';
import { mediaMatchesStepLanguage } from '../../../utils/mediaLanguage';

// Language-field helpers live in utils/mediaLanguage so context-layer callers
// don't have to import from this component subtree. Re-exported here because
// this module has long been their import site.
export {
  parseMediaLanguageField,
  parseMediaLanguageBcp47,
  formatMediaLanguageField,
  isLanguageFilterActive,
  mediaMatchesStepLanguage,
} from '../../../utils/mediaLanguage';

export interface IGuidedOutputMatchOpts {
  artifactTypeId: string;
  /** Current vernacular mediafile id. When set, row must link via sourceMedia. */
  vernacularMediaId?: string;
  /**
   * Step LWC bcp47. When set (and not `und`), row languagebcp47 must match.
   * Omitted for Careful Speech / callers without language scoping.
   */
  languageBcp47?: string;
}

/**
 * Shared scope for Phrase BT / Retell / Careful Speech guided outputs:
 * artifact type + current vernacular sourceMedia (+ optional language).
 * Never qualifies on sourceVersion alone.
 */
export function matchesGuidedOutputRow(
  row: IRow,
  opts: IGuidedOutputMatchOpts
): boolean {
  if (related(row.mediafile, 'artifactType') !== opts.artifactTypeId) {
    return false;
  }
  if (opts.vernacularMediaId) {
    if (related(row.mediafile, 'sourceMedia') !== opts.vernacularMediaId) {
      return false;
    }
  }
  return mediaMatchesStepLanguage(row.mediafile, opts.languageBcp47);
}

/** The take the step shows, by the same rule that prunes the ones it hides. */
export function pickLatestGuidedOutputRow(matches: IRow[]): IRow | undefined {
  return matches.reduce<IRow | undefined>(
    (best, row) =>
      !best || isNewerTake(row.mediafile, best.mediafile) ? row : best,
    undefined
  );
}

/** Named-region key for Phrase BT segment boundaries for a language. */
export function phraseBtBoundaryRegionName(bcp47: string): string {
  return `BT:${bcp47}`;
}
