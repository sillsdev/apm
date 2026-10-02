import { BookName, PassageD, SectionD } from '../../../model';
import { related } from '../../../crud/related';
import { sectionCompare } from '../../../crud/section';
import { passageCompare } from '../../../crud/passage';
import { passageTypeFromRef } from '../../../control/passageTypeFromRef';
import { PassageTypeEnum } from '../../../model/passageType';
import { sectionLabel, passageLabel } from './internalizeLabels';

export type SelectSectionRowKind = 'section' | 'passage';

export interface SelectSectionRow {
  id: number;
  recId: string;
  name: string;
  passages: string;
  parentId: string;
  kind: SelectSectionRowKind;
}

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
        // section/passage are InitializedRecords here, so `id` is always a
        // defined string — no `?? ''` fallback (which could seed duplicate
        // empty-string keys and break selection mapping).
        recId: section.id,
        name: sectionLabel(section, organizedBy),
        passages: passageCount.toString(),
        parentId: '',
        kind: 'section',
      });
      // Flat plans are section-only; do not list passage children (TT-6936).
      if (isFlat) return;
      // Infer PassageD (not Passage) so `passage.id` stays a required string.
      sectionPassages.forEach((passage) => {
        rowData.push({
          id: id++,
          recId: passage.id,
          name: passageLabel(passage, bookData),
          passages: '',
          parentId: section.id,
          kind: 'passage',
        });
      });
    });
  return rowData;
}
