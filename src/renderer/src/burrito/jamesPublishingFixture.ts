import { AltBkSeq, BookSeq } from '../model/section';
import type { BibleD } from '../model';
import type { GraphicD } from '../model';
import type { MediaFileD } from '../model';
import type { PassageD } from '../model';
import type { SectionArray, SectionD } from '../model';

export const JAMES_BOOK = 'JAS';
export const JAMES_BOOK_PATH = '/burrito/JAS';

/** Remote numeric ids for section graphics (resourceId on GraphicD). */
export const JAMES_SECTION_REMOTE_NUM: Record<string, number> = {
  'sec-book': 901,
  'sec-alt': 902,
  'sec-m1': 903,
  'sec-s1': 904,
  'sec-m2': 905,
  'sec-s2': 906,
};

export const jamesBibleFixture = {
  id: 'bib-james',
  type: 'bible',
  attributes: {
    bibleId: 'TST',
    bibleName: 'Test',
    iso: 'eng',
  },
} as BibleD;

export function copyDests(ipc: {
  copyFile: { mock: { calls: unknown[][] } };
}): string[] {
  return ipc.copyFile.mock.calls.map((c) => c[1] as string);
}

export function destForMediaSrc(
  ipc: { copyFile: { mock: { calls: unknown[][] } } },
  srcSubstring: string
): string | undefined {
  const call = ipc.copyFile.mock.calls.find((c) =>
    (c[0] as string).includes(srcSubstring)
  );
  return call ? (call[1] as string) : undefined;
}

export function chapterInPath(p: string): string | undefined {
  return p.match(/\/(\d{3})\//)?.[1];
}

export function isBookRootPath(p: string, bookPath: string): boolean {
  if (!p.startsWith(`${bookPath}/`)) return false;
  const suffix = p.slice(bookPath.length);
  return suffix.startsWith('/') && !/\/\d{3}\//.test(suffix);
}

export interface JamesPublishingFixture {
  planId: string;
  projectId: string;
  sectionMap: SectionArray;
  /** Sections passed to burrito hooks (book rows resolved via sectionsAll). */
  sections: SectionD[];
  sectionsAll: SectionD[];
  passages: PassageD[];
  mediafiles: MediaFileD[];
  graphics: GraphicD[];
  sharedResources: unknown[];
}

function sectionRow(
  id: string,
  sequencenum: number,
  opts: {
    state?: string;
    titleMediaId?: string;
    planId: string;
  }
): SectionD {
  const rels: Record<string, unknown> = {
    plan: { data: { id: opts.planId } },
  };
  if (opts.titleMediaId) {
    rels.titleMediafile = { data: { id: opts.titleMediaId } };
  }
  return {
    id,
    type: 'section',
    attributes: {
      sequencenum,
      state: opts.state ?? '',
    },
    relationships: rels,
  } as unknown as SectionD;
}

function titleMedia(id: string, filename: string): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: {
      audioUrl: `/tmp/${filename}`,
      originalFile: filename,
      contentType: 'audio/mpeg',
    },
  } as unknown as MediaFileD;
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
    keys: { remoteId: id },
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

function sectionGraphic(
  id: string,
  sectionId: string,
  mediaId: string
): GraphicD {
  return {
    id,
    type: 'graphic',
    keys: { remoteId: id },
    attributes: {
      resourceType: 'section',
      resourceId: JAMES_SECTION_REMOTE_NUM[sectionId],
      info: '',
    },
    relationships: {
      mediafile: { data: { id: mediaId } },
    },
  } as unknown as GraphicD;
}

function graphicMedia(id: string, filename: string): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: {
      audioUrl: `/tmp/${filename}`,
      originalFile: filename,
      contentType: 'image/png',
    },
  } as unknown as MediaFileD;
}

function scripturePassage(
  id: string,
  sectionId: string,
  reference: string,
  sequencenum: number,
  startChapter: number,
  startVerse: number,
  endChapter: number,
  endVerse: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      book: JAMES_BOOK,
      reference,
      sequencenum,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
    },
    relationships: {
      section: { data: { id: sectionId } },
      sharedResource: { data: null },
    },
  } as unknown as PassageD;
}

function notePassage(
  id: string,
  sectionId: string,
  label: string,
  sequencenum: number,
  startChapter?: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      book: JAMES_BOOK,
      reference: `NOTE|${label}`,
      sequencenum,
      startChapter: startChapter ?? 0,
      startVerse: 0,
      endChapter: startChapter ?? 0,
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
      book: JAMES_BOOK,
      reference: `CHNUM|${chapter}`,
      sequencenum,
      startChapter: chapter,
      startVerse: 0,
      endChapter: chapter,
      endVerse: 0,
    },
    relationships: {
      section: { data: { id: sectionId } },
      sharedResource: { data: null },
    },
  } as unknown as PassageD;
}

export function buildJamesPublishingFixture(): JamesPublishingFixture {
  const planId = 'plan-james';
  const projectId = 'proj-james';

  const sectionMap: SectionArray = [
    [1.5, 'M1'],
    [2, 'M1 S1'],
    [3.5, 'M2'],
    [4, 'M2 S2'],
  ];

  const secBook = sectionRow('sec-book', BookSeq, {
    state: `BOOK ${JAMES_BOOK}`,
    titleMediaId: 'med-book-title',
    planId,
  });
  const secAlt = sectionRow('sec-alt', AltBkSeq, {
    state: `ALTBK ${JAMES_BOOK}`,
    titleMediaId: 'med-alt-title',
    planId,
  });
  const secM1 = sectionRow('sec-m1', 1.5, {
    titleMediaId: 'med-m1-title',
    planId,
  });
  const secS1 = sectionRow('sec-s1', 2, {
    titleMediaId: 'med-s1-title',
    planId,
  });
  const secM2 = sectionRow('sec-m2', 3.5, {
    titleMediaId: 'med-m2-title',
    planId,
  });
  const secS2 = sectionRow('sec-s2', 4, {
    titleMediaId: 'med-s2-title',
    planId,
  });

  const sectionsAll = [secBook, secAlt, secM1, secS1, secM2, secS2];
  const sections = [secM1, secS1, secM2, secS2];

  const passages: PassageD[] = [
    notePassage('p-note-book', 'sec-book', 'Book', 1),
    notePassage('p-note-alt', 'sec-alt', 'AltBook', 1),
    notePassage('p-note-m1', 'sec-m1', 'M1', 1),
    chnumPassage('p-chnum-1', 'sec-s1', 1, 0),
    scripturePassage(
      'p-jas-1-1',
      'sec-s1',
      'JAS 1:1',
      1,
      1,
      1,
      1,
      26
    ),
    notePassage('p-note-s1', 'sec-s1', 'S1', 2, 1),
    notePassage('p-note-m2', 'sec-m2', 'M2', 1),
    chnumPassage('p-chnum-14', 'sec-s2', 14, 0),
    scripturePassage(
      'p-jas-14-1',
      'sec-s2',
      'JAS 14:1',
      1,
      14,
      1,
      14,
      26
    ),
    notePassage('p-note-s2', 'sec-s2', 'S2', 2, 14),
    notePassage('p-note-ch14', 'sec-s2', 'Ch14', 3, 14),
  ];

  const mediafiles: MediaFileD[] = [
    titleMedia('med-book-title', 'book-title.mp3'),
    titleMedia('med-alt-title', 'alt-title.mp3'),
    titleMedia('med-m1-title', 'm1-title.mp3'),
    titleMedia('med-s1-title', 's1-title.mp3'),
    titleMedia('med-m2-title', 'm2-title.mp3'),
    titleMedia('med-s2-title', 's2-title.mp3'),
    graphicMedia('med-g-book', 'book-graphic.png'),
    graphicMedia('med-g-alt', 'alt-graphic.png'),
    graphicMedia('med-g-m1', 'm1-graphic.png'),
    graphicMedia('med-g-s1', 's1-graphic.png'),
    graphicMedia('med-g-m2', 'm2-graphic.png'),
    graphicMedia('med-g-s2', 's2-graphic.png'),
    noteMedia('med-book-note', 'p-note-book', planId, 'book-note.mp3'),
    noteMedia('med-alt-note', 'p-note-alt', planId, 'alt-note.mp3'),
    noteMedia('med-m1-note', 'p-note-m1', planId, 'm1-note.mp3'),
    noteMedia('med-s1-note', 'p-note-s1', planId, 's1-note.mp3'),
    noteMedia('med-m2-note', 'p-note-m2', planId, 'm2-note.mp3'),
    noteMedia('med-s2-note', 'p-note-s2', planId, 's2-note.mp3'),
    noteMedia('med-ch14-note', 'p-note-ch14', planId, 'ch14-note.mp3'),
    noteMedia('med-chnum-1', 'p-chnum-1', planId, 'chnum-1-title.ogg'),
    noteMedia('med-chnum-14', 'p-chnum-14', planId, 'chnum-14-title.ogg'),
  ];

  const graphics: GraphicD[] = [
    sectionGraphic('g-book', 'sec-book', 'med-g-book'),
    sectionGraphic('g-alt', 'sec-alt', 'med-g-alt'),
    sectionGraphic('g-m1', 'sec-m1', 'med-g-m1'),
    sectionGraphic('g-s1', 'sec-s1', 'med-g-s1'),
    sectionGraphic('g-m2', 'sec-m2', 'med-g-m2'),
    sectionGraphic('g-s2', 'sec-s2', 'med-g-s2'),
  ];

  return {
    planId,
    projectId,
    sectionMap,
    sections,
    sectionsAll,
    passages,
    mediafiles,
    graphics,
    sharedResources: [],
  };
}

/** All publishing rows for notes export (includes Book / Alt Book). */
export function jamesNoteSections(fixture: JamesPublishingFixture): SectionD[] {
  return [...fixture.sectionsAll].sort(
    (a, b) => a.attributes.sequencenum - b.attributes.sequencenum
  );
}
