import {
  BookName,
  Passage,
  PassageD,
  Section,
  SectionD,
} from '../../../model';
import { related } from '../../../crud/related';
import {
  sectionNumber,
  sectionCompare,
  sectionRef,
} from '../../../crud/section';
import { passageCompare, passageDescText } from '../../../crud/passage';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';

export interface SelectSectionRow {
  id: number;
  recId: string;
  name: string;
  passages: string;
  parentId: string;
}

const getSection = (
  section: Section,
  passages: Passage[],
  sectionMap: Map<number, string>,
  bookData: BookName[]
) => {
  const name =
    sectionRef(section, passages, bookData) ?? section?.attributes?.name ?? '';
  return sectionNumber(section, sectionMap) + '.\u00A0\u00A0' + name;
};

const getReference = (passage: Passage, bookData: BookName[] = []) => {
  return passageDescText(passage, bookData);
};

export function buildSelectSectionRows(opts: {
  passages: PassageD[];
  sections: SectionD[];
  bookData: BookName[];
  planId: string | undefined;
  isFlat: boolean;
  sectionMap: Map<number, string>;
}): SelectSectionRow[] {
  const { passages, sections, bookData, planId, isFlat, sectionMap } = opts;
  const rowData: SelectSectionRow[] = [];
  let id = 1;
  sections
    .filter((s) => related(s, 'plan') === planId && s.attributes)
    .sort(sectionCompare)
    .forEach((section) => {
      const sectionpassages = passages
        .filter(
          (ps) =>
            related(ps, 'section') === section.id &&
            passageTypeFromRef(ps.attributes?.reference, isFlat) ===
              PassageTypeEnum.PASSAGE
        )
        .sort(passageCompare);
      const passageCount = sectionpassages.length;
      rowData.push({
        id: id++,
        recId: section.id,
        name: getSection(section, sectionpassages, sectionMap, bookData),
        passages: passageCount.toString(),
        parentId: '',
      });
      // Flat plans are section-only; do not list passage children (TT-6936).
      if (isFlat) return;
      sectionpassages.forEach((passage: Passage) => {
        rowData.push({
          id: id++,
          recId: passage.id as string,
          name: `\u00A0\u00A0\u00A0${sectionNumber(section, sectionMap)}.${getReference(
            passage,
            bookData
          )}`,
          passages: '',
          parentId: passageCount === 1 ? '' : section.id,
        });
      });
    });
  return rowData;
}

/** Selection identity type for a row in the Select Sections dialog. */
export function selectSectionRowType(
  row: Pick<SelectSectionRow, 'parentId' | 'passages'>,
  isFlat: boolean
): 'section' | 'passage' {
  if (row.parentId === '' && (isFlat || parseInt(row.passages, 10) > 1)) {
    return 'section';
  }
  return 'passage';
}
