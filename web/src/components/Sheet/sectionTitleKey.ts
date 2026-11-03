import type { ISheet } from '../../model';

/** Cell key for a section title: the section id, or its sheet row until it is saved. */
export function sectionTitleKey(row: ISheet | undefined, rowIndex: number) {
  const id = row?.sectionId?.id;
  return id ? `title-${id}` : `title-row-${rowIndex}`;
}
