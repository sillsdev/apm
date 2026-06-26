import path from 'path-browserify';
import related from '../crud/related';
import { parseRef } from '../crud/passage';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageTypeEnum';
import { PassageD, SectionD } from '../model';
import { AltBkSeq, BookSeq } from '../model/section';
import { pad3 } from '../utils/pad3';

export function isMovementSection(section: SectionD): boolean {
  const seq = section.attributes?.sequencenum ?? 0;
  return seq !== Math.floor(seq);
}

export function isBookLevelSection(section: SectionD): boolean {
  const seq = section.attributes?.sequencenum ?? 0;
  return seq === BookSeq || seq === AltBkSeq;
}

export interface ResolveBurritoExportFolderInput {
  section: SectionD;
  bookPath: string;
  sections: SectionD[];
  passages: PassageD[];
  computeSectionRef: (sectionId: string) => string;
  computeMovementRef: (sectionId: string) => string;
}

export interface BurritoExportFolder {
  folderPath: string;
  /** Set when assets live under a chapter subfolder; null for book root. */
  chapter: string | null;
  scopeRef: string;
}

const sortAscend = (a: PassageD, b: PassageD) =>
  a.attributes.sequencenum - b.attributes.sequencenum;

const findScripturePassage = (p: PassageD) =>
  passageTypeFromRef(p.attributes.reference, false) === PassageTypeEnum.PASSAGE;

function chapterFromSectionPassages(
  sectionId: string,
  passages: PassageD[]
): number | undefined {
  const sectPass = passages
    .filter((p) => related(p, 'section') === sectionId)
    .sort(sortAscend);
  const chnum = sectPass.find(
    (p) =>
      passageTypeFromRef(p.attributes.reference, false) ===
      PassageTypeEnum.CHAPTERNUMBER
  );
  if (chnum) {
    const pipe = chnum.attributes.reference.split('|');
    const ch = parseInt(pipe[1] ?? '', 10);
    if (ch) return ch;
  }
  const firstPassage = sectPass.find(findScripturePassage);
  if (firstPassage) {
    parseRef(firstPassage);
    return firstPassage.attributes.startChapter || 1;
  }
  return undefined;
}

/** Start chapter for a movement row: first scripture/CHNUM in this movement's span. */
function movementChapterStart(
  movementSection: SectionD,
  sections: SectionD[],
  passages: PassageD[]
): number {
  const planId = related(movementSection, 'plan');
  const sorted = sections
    .filter((s) => related(s, 'plan') === planId)
    .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
  const startIndex = sorted.findIndex((s) => s.id === movementSection.id);
  if (startIndex === -1) return 1;
  let endIndex = sorted.findIndex(
    (s, i) =>
      i > startIndex &&
      s.attributes.sequencenum !== Math.floor(s.attributes.sequencenum)
  );
  if (endIndex === -1) endIndex = sorted.length;
  for (let i = startIndex; i < endIndex; i++) {
    const ch = chapterFromSectionPassages(sorted[i]?.id ?? '', passages);
    if (ch) return ch;
  }
  return 1;
}

export function resolveBurritoExportFolder({
  section,
  bookPath,
  sections,
  passages,
  computeSectionRef,
  computeMovementRef,
}: ResolveBurritoExportFolderInput): BurritoExportFolder {
  if (isBookLevelSection(section)) {
    return { folderPath: bookPath, chapter: null, scopeRef: '' };
  }
  if (isMovementSection(section)) {
    const chapterNum = movementChapterStart(section, sections, passages);
    return {
      folderPath: path.join(bookPath, pad3(chapterNum)),
      chapter: chapterNum.toString(),
      scopeRef: computeMovementRef(section.id),
    };
  }
  const scopeRef = computeSectionRef(section.id);
  let chapterNum = parseInt(scopeRef.split(':')[0] ?? '', 10);
  if (isNaN(chapterNum)) {
    chapterNum = chapterFromSectionPassages(section.id, passages) ?? 1;
  }
  return {
    folderPath: path.join(bookPath, pad3(chapterNum)),
    chapter: chapterNum.toString(),
    scopeRef,
  };
}
