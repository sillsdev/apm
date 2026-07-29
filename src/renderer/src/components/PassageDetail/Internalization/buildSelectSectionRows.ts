import {
  BookName,
  Passage,
  PassageD,
  SectionD,
} from '../../../model';
import { related } from '../../../crud/related';
import { sectionCompare } from '../../../crud/section';
import { passageCompare, passageRefText } from '../../../crud/passage';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';

export type SelectSectionRowKind = 'section' | 'passage';

export interface SelectSectionRow {
  id: number;
  recId: string;
  name: string;
  passages: string;
  parentId: string;
  kind: SelectSectionRowKind;
}

const getReference = (passage: Passage, bookData: BookName[] = []) => {
  return passageRefText(passage, bookData);
};

export function buildSelectSectionRows(opts: {
  passages: PassageD[];
  sections: SectionD[];
  bookData: BookName[];
  planId: string | undefined;
  isFlat: boolean;
  organizedBy: string;
}): SelectSectionRow[] {
  const { passages, sections, bookData, planId, isFlat, organizedBy } = opts;
  const rowData: SelectSectionRow[] = [];
  let id = 1;
  sections
    .filter((s) => related(s, 'plan') === planId && s.attributes)
    .sort(sectionCompare)
    .forEach((section) => {
      const sectionPassages = passages
        .filter((ps) => related(ps, 'section') === section.id)
        .filter(
          (ps) =>
            passageTypeFromRef(ps.attributes?.reference, isFlat) ===
            PassageTypeEnum.PASSAGE
        )
        .sort(passageCompare);
      const passageCount = sectionPassages.length;
      rowData.push({
        id: id++,
        recId: section.id ?? '',
        name:
          section.attributes.name ||
          `${organizedBy} ${section.attributes.sequencenum}`,
        passages: passageCount.toString(),
        parentId: '',
        kind: 'section',
      });
      // Flat plans are section-only; do not list passage children (TT-6936).
      if (isFlat) return;
      sectionPassages.forEach((passage: Passage) => {
        rowData.push({
          id: id++,
          recId: passage.id ?? '',
          name: getReference(passage, bookData),
          passages: '',
          parentId: section.id ?? '',
          kind: 'passage',
        });
      });
    });
  return rowData;
}
