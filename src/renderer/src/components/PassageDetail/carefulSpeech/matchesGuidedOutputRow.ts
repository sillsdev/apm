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
export function parseMediaLanguageField(value: unknown): {
  languageName: string;
  bcp47: string;
} {
  if (value == null || value === '') return { languageName: '', bcp47: 'und' };
  if (typeof value === 'object') {
    const obj = value as { languageName?: unknown; bcp47?: unknown };
    return {
      languageName: String(obj.languageName ?? ''),
      bcp47: String(obj.bcp47 ?? 'und') || 'und',
    };
  }
  const str = String(value).trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      return parseMediaLanguageField(JSON.parse(str));
    } catch {
      /* fall through */
    }
  }
  const pipe = str.indexOf('|');
  if (pipe === -1) return { languageName: '', bcp47: str || 'und' };
  return {
    languageName: str.slice(0, pipe),
    bcp47: str.slice(pipe + 1) || 'und',
  };
}

export function parseMediaLanguageBcp47(value: unknown): string {
  return parseMediaLanguageField(value).bcp47;
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
 * Whether mediafile language matches step LWC.
 * When the filter is inactive (`undefined` / `und`), all media match.
 */
export function mediaMatchesStepLanguage(
  mediafile: MediaFileD | undefined,
  languageBcp47?: string
): boolean {
  if (!isLanguageFilterActive(languageBcp47)) return true;
  return mediaLanguageBcp47(mediafile) === languageBcp47;
}

/** Keep only media stamped with the step LWC (no-op when filter inactive). */
export function filterMediaByStepLanguage<T extends MediaFileD>(
  media: T[],
  languageBcp47?: string
): T[] {
  if (!isLanguageFilterActive(languageBcp47)) return media;
  return media.filter((m) => mediaMatchesStepLanguage(m, languageBcp47));
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
