import { related } from '../../../crud/related';
import { IRow } from '../../../context/PassageDetailContext';
import { MediaFileD } from '../../../model';

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

/** Parse `Name|bcp47` (or bare bcp47) without pulling StepEditor/ASR deps. */
export function parseMediaLanguageBcp47(value: unknown): string {
  if (value == null || value === '') return 'und';
  if (typeof value === 'object') {
    const obj = value as { bcp47?: unknown };
    return String(obj.bcp47 ?? 'und') || 'und';
  }
  const str = String(value);
  const pipe = str.indexOf('|');
  if (pipe === -1) return str || 'und';
  return str.slice(pipe + 1) || 'und';
}

export function formatMediaLanguageField(
  languageName: string,
  bcp47: string
): string {
  return `${languageName}|${bcp47 || 'und'}`;
}

function mediaLanguageBcp47(mediafile: MediaFileD | undefined): string {
  return parseMediaLanguageBcp47(mediafile?.attributes?.languagebcp47);
}

/** True when step language should filter guided outputs. */
export function isLanguageFilterActive(languageBcp47?: string): boolean {
  return Boolean(languageBcp47 && languageBcp47 !== 'und');
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
  if (isLanguageFilterActive(opts.languageBcp47)) {
    const rowBcp = mediaLanguageBcp47(row.mediafile);
    if (rowBcp !== opts.languageBcp47) {
      return false;
    }
  }
  return true;
}

export function pickLatestGuidedOutputRow(matches: IRow[]): IRow | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return [...matches].sort((a, b) => {
    const da = a.mediafile?.attributes?.dateCreated ?? '';
    const db = b.mediafile?.attributes?.dateCreated ?? '';
    if (da !== db) return db.localeCompare(da);
    return (b.mediafile?.id ?? '').localeCompare(a.mediafile?.id ?? '');
  })[0];
}

/** Named-region key for Phrase BT segment boundaries for a language. */
export function phraseBtBoundaryRegionName(bcp47: string): string {
  return `BT:${bcp47}`;
}
