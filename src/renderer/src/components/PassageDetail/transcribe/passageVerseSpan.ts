import { getLastVerse } from '../../../business/localParatext/getLastVerse';
import { PassageD } from '../../../model';

export interface PassageVerseSpanInput {
  book: string;
  startChapter?: number;
  endChapter?: number;
  startVerse?: number;
  endVerse?: number;
}

export function passageVerseSpanFromPassage(
  passage?: PassageD
): PassageVerseSpanInput | undefined {
  if (!passage?.attributes) return undefined;
  return {
    book: passage.attributes.book,
    startChapter: passage.attributes.startChapter,
    endChapter: passage.attributes.endChapter,
    startVerse: passage.attributes.startVerse,
    endVerse: passage.attributes.endVerse,
  };
}

export interface ParsedTaskVerse {
  chapter: number;
  verse: number;
}

/**
 * Parse a TRTask / Mark Verses verse label into chapter + starting verse.
 * Examples: "11", "3-4", "1:80", "1:80-2:1"
 */
export function parseTaskVerseLabel(
  taskVerseLabel: string,
  defaultChapter: number
): ParsedTaskVerse | undefined {
  const trimmed = taskVerseLabel.trim();
  if (!trimmed) return undefined;

  const crossChapter = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(trimmed);
  if (crossChapter) {
    return {
      chapter: parseInt(crossChapter[1], 10),
      verse: parseInt(crossChapter[2], 10),
    };
  }

  const withChapter = /^(\d+):(\d+)/.exec(trimmed);
  if (withChapter) {
    return {
      chapter: parseInt(withChapter[1], 10),
      verse: parseInt(withChapter[2], 10),
    };
  }

  const range = /^(\d+)-/.exec(trimmed);
  if (range) {
    return { chapter: defaultChapter, verse: parseInt(range[1], 10) };
  }

  const single = /^(\d+)/.exec(trimmed);
  if (single) {
    return { chapter: defaultChapter, verse: parseInt(single[1], 10) };
  }

  return undefined;
}

/** Count inclusive verses in the passage reference span. */
export function countPassageVerses(passage: PassageVerseSpanInput): number {
  const { book, startChapter, endChapter, startVerse, endVerse } = passage;
  if (!startChapter || !startVerse || !endVerse) return 0;

  const endCh = endChapter ?? startChapter;
  if (endCh === startChapter) {
    return endVerse - startVerse + 1;
  }
  if (endCh === startChapter + 1) {
    const lastVerse = getLastVerse(book, startChapter);
    if (!lastVerse) return 0;
    return lastVerse - startVerse + 1 + endVerse;
  }
  return 0;
}

/** 1-based position of a task verse within the passage span. */
export function passageVersePosition(
  passage: PassageVerseSpanInput,
  taskVerseLabel: string
): number {
  const { startChapter, startVerse } = passage;
  if (!startChapter || !startVerse) return 0;

  const parsed = parseTaskVerseLabel(taskVerseLabel, startChapter);
  if (!parsed) return 0;

  const endCh = passage.endChapter ?? startChapter;
  if (endCh === startChapter) {
    return parsed.verse - startVerse + 1;
  }

  const lastVerse = getLastVerse(passage.book, startChapter);
  if (!lastVerse) return 0;

  if (parsed.chapter === startChapter) {
    return parsed.verse - startVerse + 1;
  }
  if (parsed.chapter === endCh) {
    return lastVerse - startVerse + 1 + parsed.verse;
  }
  return 0;
}

/** User-facing verse label for progress (chapter prefix when cross-chapter). */
export function formatTaskVerseLabelForProgress(
  passage: PassageVerseSpanInput,
  taskVerseLabel: string
): string {
  const { startChapter, endChapter } = passage;
  const endCh = endChapter ?? startChapter ?? 1;
  const startCh = startChapter ?? 1;
  const crossChapter = endCh !== startCh;

  if (crossChapter) {
    if (taskVerseLabel.includes(':')) return taskVerseLabel;
    const parsed = parseTaskVerseLabel(taskVerseLabel, startCh);
    if (parsed) return `${parsed.chapter}:${taskVerseLabel}`;
  }
  return taskVerseLabel;
}

/** User-facing passage end label for progress. */
export function formatPassageEndingForProgress(
  passage: PassageVerseSpanInput
): string {
  const { startChapter, endChapter, endVerse } = passage;
  if (!endVerse) return '';
  const endCh = endChapter ?? startChapter ?? 1;
  const startCh = startChapter ?? 1;
  if (endCh !== startCh) return `${endCh}:${endVerse}`;
  return String(endVerse);
}
