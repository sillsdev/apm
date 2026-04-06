import Memory from '@orbit/memory';
import { parseRef } from '../../crud/passage';
import { PassageInfo } from './PassageInfo';
import { vInt } from './vInt';
import { parseTranscription } from './parseTranscription';
import { getExistingVerses, getVerses } from './usxNodeContent';
import {
  addParatextVerse,
  addSection,
  findNodeAfterVerse,
  moveToPara,
  removeOverlappingVerses,
  removeSection,
  removeVerse,
  replaceText,
} from './usxNodeChange';
import { isSection } from './usxNodeType';
import { Passage, SectionArray } from '../../model';
import { crossChapterRefs } from './crossChapterRefs';

const passageVerses = (p: Passage) =>
  (p?.attributes.startVerse || 0).toString() +
  ((p?.attributes.endVerse || 0) > (p?.attributes.startVerse || 0)
    ? '-' + (p?.attributes.endVerse || 0).toString()
    : '');

//does the given verse marker appears at the start of a new line (or at the very start) in the transcription string.
const startsParagraphInTranscription = (transcription: string, p: Passage) => {
  const v = passageVerses(p).replace('-', '\\-');
  const refPat = new RegExp(
    `(?:^|(?:\\r\\n|\\n|\\r|\\\\n)\\s*)\\\\v\\s*${v}\\s`,
    'i'
  );
  return refPat.test(transcription);
};

export interface IPostPass {
  doc: Document;
  chap: string;
  currentPI: PassageInfo;
  exportNumbers: boolean;
  sectionArr: SectionArray | undefined;
  memory: Memory;
}

export const postPass = ({
  doc,
  chap,
  currentPI,
  exportNumbers,
  sectionArr,
  memory,
}: IPostPass) => {
  //get transcription
  const transcription = currentPI.transcription;
  const hasVerse = transcription.indexOf('\\v') > -1;

  // set start and end for currently loaded chapter
  const curChap = vInt(chap);
  currentPI.passage.attributes.startChapter = undefined;
  parseRef(currentPI.passage);
  const curPass = {
    ...currentPI.passage,
    attributes: { ...currentPI.passage.attributes },
  };
  const { startChapter, endChapter } = curPass.attributes;
  if (startChapter !== endChapter && !hasVerse) {
    curPass.attributes.startChapter = crossChapterRefs(curPass);
  }

  const parsed = parseTranscription(curPass, transcription);
  const parsedInChapter = parsed.filter(
    (p) => p.attributes.startChapter === curChap
  );
  if (parsed.length > 1) {
    // remove the full parsed span in this chapter before reinserting
    const startVerse = Math.min(
      ...parsedInChapter.map((p) => p.attributes.startVerse || 0)
    );
    const endVerse = Math.max(
      ...parsedInChapter.map((p) => p.attributes.endVerse || 0)
    );
    if (startVerse > 0 && endVerse > 0) {
      const cleanupPass = {
        ...curPass,
        attributes: {
          ...curPass.attributes,
          startChapter: curChap,
          endChapter: curChap,
          startVerse,
          endVerse,
        },
      } as Passage;
      const existing = getExistingVerses(doc, cleanupPass);
      if (existing.exactVerse) removeVerse(existing.exactVerse);
      existing.allVerses.forEach((v) => {
        if (isSection(v)) removeSection(v);
        else removeVerse(v);
      });
    }
  }
  const altRef =
    !hasVerse &&
    currentPI.passage.attributes.startChapter !==
      currentPI.passage.attributes.endChapter
      ? `[${curPass.attributes.reference}] `
      : '';
  let lastInserted: Element | undefined;
  parsedInChapter.forEach((p) => {
    // Cross-chapter transcriptions (e.g. "\\v 17 ... \\c 2 \\v 1-10 ..."):
    // the first verse of THIS chapter won't match ^ in startsParagraphInTranscription
    const isFirstVerse = lastInserted === undefined;
    const paraForThisVerse =
      isFirstVerse ||
      !hasVerse ||
      startsParagraphInTranscription(transcription, p);
    let thisVerse = removeOverlappingVerses(doc, p);
    const transcript = altRef + p.attributes.lastComment;

    if (thisVerse) {
      if (paraForThisVerse) thisVerse = moveToPara(doc, thisVerse);
      if (thisVerse) lastInserted = replaceText(doc, thisVerse, transcript);
    } else {
      const verses = getVerses(doc.documentElement);
      const nextVerse = findNodeAfterVerse(
        doc,
        verses,
        p?.attributes.startVerse || 0,
        p?.attributes.endVerse || 0
      );
      thisVerse = addParatextVerse({
        doc,
        sibling: paraForThisVerse ? nextVerse : lastInserted,
        verses: passageVerses(p),
        transcript,
        before: paraForThisVerse,
        paraForThisVerse: paraForThisVerse,
      });
      lastInserted = thisVerse;
    }
    if (p.attributes.sequencenum === 1 && thisVerse) {
      addSection({
        doc,
        passage: p,
        verse: thisVerse,
        memory,
        addNumbers: exportNumbers,
        sectionArr,
      });
    }
  });
};
