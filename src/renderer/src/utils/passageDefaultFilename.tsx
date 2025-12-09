import { findRecord } from '../crud/tryFindRecord';
import { getVernacularMediaRec } from '../crud/media';
import { parseRef } from '../crud/passage';
import { related } from '../crud/related';
import { VernacularTag } from '../crud/useArtifactType';
import { BookName, Passage, PassageD, Plan, Section } from '../model';
import Memory from '@orbit/memory';
import { cleanFileName } from './cleanFileName';
import { pad3 } from './pad3';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';
import {
  BOOK_CHAPTER_PASSAGE_TEMPLATE,
  NOTE_TITLE_TEMPLATE,
  REFERENCE_TEMPLATE,
  TemplateCode,
} from '../control/TemplateEditorUtils';
import { JSONParse } from './jsonParse';

export const passageDefaultSuffix = (
  planId: string,
  memory: Memory,
  offline: boolean
): string => {
  const planRec = memory?.cache.query((q) =>
    q.findRecord({ type: 'plan', id: planId })
  ) as Plan;
  return '_' + (offline ? 'l' : '') + planRec.attributes.slug;
};

const noPassageRef = (passage: Passage, memory: Memory): string => {
  const sect = findRecord(
    memory,
    'section',
    related(passage, 'section')
  ) as Section;
  const plan = findRecord(memory, 'plan', related(sect, 'plan')) as Plan;
  if (plan.attributes.flat && sect.attributes.name.length > 0)
    return sect.attributes.name;
  return `S${sect.attributes.sequencenum.toString().padStart(3, '0')}${
    plan.attributes.flat
      ? ''
      : `_P${passage.attributes.sequencenum.toString().padStart(3, '0')}`
  }`;
};
/**
 * Applies a template string by replacing template codes with actual values
 */
const applyTemplate = (
  template: string,
  passage: PassageD,
  memory: Memory,
  books?: BookName[],
  title?: string
): string => {
  parseRef(passage);
  const book = passage.attributes?.book ?? '';
  const sect = findRecord(
    memory,
    'section',
    related(passage, 'section')
  ) as Section;

  // Get values for template codes
  const values: Record<string, string> = {
    [TemplateCode.BOOK]: book,
    [TemplateCode.BOOKNAME]:
      books?.filter((b) => b.code.toUpperCase() === book.toUpperCase())[0]
        ?.abbr ?? book,
    [TemplateCode.SECT]: sect
      ? sect.attributes.sequencenum.toString().padStart(3, '0')
      : '',
    [TemplateCode.PASS]: passage.attributes.sequencenum
      .toString()
      .padStart(3, '0'),
    [TemplateCode.CHAP]: passage.attributes.startChapter
      ? pad3(passage.attributes.startChapter)
      : '',
    [TemplateCode.BEG]: passage.attributes.startVerse
      ? pad3(passage.attributes.startVerse)
      : '',
    [TemplateCode.END]: passage.attributes.endVerse
      ? pad3(passage.attributes.endVerse)
      : passage.attributes.startVerse
        ? pad3(passage.attributes.startVerse)
        : '',
    [TemplateCode.REF]: cleanFileName(
      passage.attributes.reference ?? noPassageRef(passage, memory)
    ),
    [TemplateCode.TITLE]: cleanFileName(
      title ?? passage.attributes.title ?? noPassageRef(passage, memory)
    ),
  };

  // Replace template codes with values
  let result = template;
  Object.entries(values).forEach(([code, value]) => {
    result = result.replace(new RegExp(`\\{${code}\\}`, 'g'), value);
  });

  return result;
};

const bookChapterPassage = (passage: PassageD): string => {
  const book = passage.attributes?.book ?? '';
  const chap = pad3(passage.attributes.startChapter || 1);
  const endchap = pad3(
    passage.attributes.endChapter || passage.attributes.startChapter || 1
  );
  const start = pad3(passage.attributes.startVerse || 1);
  const end = pad3(
    passage.attributes.endVerse || passage?.attributes.startVerse || 1
  );
  return chap === endchap
    ? start === end
      ? `${book}${chap}_${start}`
      : `${book}${chap}_${start}-${end}`
    : `${book}${chap}_${start}-${endchap}_${end}`;
};
export const passageDefaultFilename = (
  passage: PassageD,
  planId: string,
  memory: Memory,
  artifactType: string | null | undefined,
  offline: boolean,
  postfix = '',
  toolSettings = '',
  books?: BookName[],
  title?: string
): string => {
  if (passage?.attributes) {
    let tmp = '';
    parseRef(passage);
    const passageType = passageTypeFromRef(passage.attributes.reference);
    const isNote = passageType === PassageTypeEnum.NOTE;
    const isScripture = !!passage.attributes.startChapter;

    // If tool settings are provided, use them

    const settings = JSONParse(toolSettings) as {
      scriptureFilenameTemplate?: string;
      generalFilenameTemplate?: string;
      notesFilenameTemplate?: string;
    };

    // Get the appropriate template from settings
    let template = '';
    if (isNote) {
      template = settings?.notesFilenameTemplate ?? NOTE_TITLE_TEMPLATE;
    } else if (isScripture) {
      template =
        settings?.scriptureFilenameTemplate ?? BOOK_CHAPTER_PASSAGE_TEMPLATE;
      if (template === BOOK_CHAPTER_PASSAGE_TEMPLATE)
        tmp = bookChapterPassage(passage);
    } else {
      template = settings?.generalFilenameTemplate ?? REFERENCE_TEMPLATE;
    }

    if (template && !tmp) {
      tmp = applyTemplate(template, passage, memory, books, title);
    }

    if (artifactType === VernacularTag) {
      const mediaRec = getVernacularMediaRec(passage.id, memory);
      if (mediaRec) {
        tmp += '_v' + (mediaRec.attributes.versionNumber + 1).toString();
      }
    }
    return (
      tmp +
      postfix +
      (planId ? passageDefaultSuffix(planId, memory, offline) : '')
    );
  }
  return '';
};
