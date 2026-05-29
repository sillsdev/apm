import { PassageD, SectionD } from '../model';
import { related } from '../crud/related';

export interface IAssignmentRow {
  recId: string;
  parentId: string;
}

export function resolveSectionForRecId(
  recId: string,
  data: IAssignmentRow[],
  sections: SectionD[],
  passages: PassageD[]
): SectionD | undefined {
  const row = data.find((r) => r.recId === recId);
  if (!row) return undefined;
  if (row.parentId === '') return sections.find((s) => s.id === recId);
  const parentId =
    row.parentId ||
    related(passages.find((p) => p.id === recId), 'section');
  return sections.find((s) => s.id === parentId);
}

export function resolveSelectedSections(
  check: string[],
  data: IAssignmentRow[],
  sections: SectionD[],
  passages: PassageD[]
): SectionD[] {
  const selected: SectionD[] = [];
  const seen = new Set<string>();
  check.forEach((recId) => {
    const section = resolveSectionForRecId(recId, data, sections, passages);
    if (section !== undefined && !seen.has(section.id)) {
      seen.add(section.id);
      selected.push(section);
    }
  });
  return selected;
}
