import { AltBkSeq, BookSeq } from '../model/section';
import type { BibleD } from '../model';
import type { MediaFileD } from '../model';
import type { PassageD } from '../model';
import type { SectionD } from '../model';

export const PHP_BOOK = 'PHP';
export const PHP_BOOK_PATH = '/burrito/PHP';

export const phpBibleFixture = {
  id: 'bib-php',
  type: 'bible',
  attributes: {
    bibleId: 'SEHGEO',
    bibleName: 'Philippians',
    iso: 'seh',
  },
} as BibleD;

export interface PhilippiansPublishingFixture {
  planId: string;
  sectionsAll: SectionD[];
  passages: PassageD[];
  mediafiles: MediaFileD[];
}

function sectionRow(
  id: string,
  sequencenum: number,
  planId: string
): SectionD {
  return {
    id,
    type: 'section',
    attributes: { sequencenum, state: '' },
    relationships: { plan: { data: { id: planId } } },
  } as unknown as SectionD;
}

function noteMedia(
  id: string,
  passageId: string,
  planId: string,
  filename: string
): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: {
      audioUrl: `/tmp/${filename}`,
      originalFile: filename,
      contentType: 'audio/mpeg',
      versionNumber: 1,
      segments: '{}',
    },
    relationships: {
      plan: { data: { id: planId } },
      passage: { data: { id: passageId } },
      artifactType: { data: null },
    },
  } as unknown as MediaFileD;
}

function notePassage(
  id: string,
  sectionId: string,
  sequencenum: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      book: PHP_BOOK,
      reference: 'NOTE',
      sequencenum,
      startChapter: 0,
      startVerse: 0,
      endChapter: 0,
      endVerse: 0,
    },
    relationships: {
      section: { data: { id: sectionId } },
      sharedResource: { data: null },
    },
  } as unknown as PassageD;
}

function chnumPassage(
  id: string,
  sectionId: string,
  chapter: number,
  sequencenum: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      book: PHP_BOOK,
      reference: `CHNUM ${chapter}`,
      sequencenum,
      startChapter: 0,
      startVerse: 0,
      endChapter: 0,
      endVerse: 0,
    },
    relationships: {
      section: { data: { id: sectionId } },
      sharedResource: { data: null },
    },
  } as unknown as PassageD;
}

function scripturePassage(
  id: string,
  sectionId: string,
  reference: string,
  sequencenum: number,
  startChapter: number,
  endChapter: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      book: PHP_BOOK,
      reference,
      sequencenum,
      startChapter,
      startVerse: 1,
      endChapter,
      endVerse: 30,
    },
    relationships: {
      section: { data: { id: sectionId } },
      sharedResource: { data: null },
    },
  } as unknown as PassageD;
}

/** Philippians-style plan: book rows + chapter-as-section with `CHNUM N` references. */
export function buildPhilippiansPublishingFixture(): PhilippiansPublishingFixture {
  const planId = 'plan-php';

  const secBook = sectionRow('sec-book', BookSeq, planId);
  const secAlt = sectionRow('sec-alt', AltBkSeq, planId);
  const secCh1 = sectionRow('sec-ch1', 1, planId);
  const secCh2 = sectionRow('sec-ch2', 2, planId);

  const sectionsAll = [secBook, secAlt, secCh1, secCh2];

  const passages: PassageD[] = [
    notePassage('p-note-book', 'sec-book', 0.01),
    notePassage('p-note-alt', 'sec-alt', 0.01),
    notePassage('p-note-ch1-section', 'sec-ch1', 0.01),
    chnumPassage('p-chnum-1', 'sec-ch1', 1, 0.02),
    notePassage('p-note-ch1-chapter', 'sec-ch1', 0.03),
    scripturePassage('p-php-1', 'sec-ch1', '1:1-30', 1, 1, 1),
    notePassage('p-note-ch2-section', 'sec-ch2', 0.01),
    chnumPassage('p-chnum-2', 'sec-ch2', 2, 0.02),
    notePassage('p-note-ch2-chapter', 'sec-ch2', 0.03),
    scripturePassage('p-php-2', 'sec-ch2', '2:1-30', 1, 2, 2),
  ];

  const mediafiles: MediaFileD[] = [
    noteMedia('med-book-note', 'p-note-book', planId, 'book-note.mp3'),
    noteMedia('med-alt-note', 'p-note-alt', planId, 'alt-note.mp3'),
    noteMedia('med-ch1-section-note', 'p-note-ch1-section', planId, 'ch1-section-note.mp3'),
    noteMedia('med-ch1-chapter-note', 'p-note-ch1-chapter', planId, 'ch1-chapter-note.mp3'),
    noteMedia('med-ch2-section-note', 'p-note-ch2-section', planId, 'ch2-section-note.mp3'),
    noteMedia('med-ch2-chapter-note', 'p-note-ch2-chapter', planId, 'ch2-chapter-note.mp3'),
  ];

  return { planId, sectionsAll, passages, mediafiles };
}

export function phpNoteSections(
  fixture: PhilippiansPublishingFixture
): SectionD[] {
  return [...fixture.sectionsAll].sort(
    (a, b) => a.attributes.sequencenum - b.attributes.sequencenum
  );
}
