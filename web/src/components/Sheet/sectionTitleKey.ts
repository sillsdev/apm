import type { ISheet } from '../../model';

/**
 * Cell key for a section title: the section id, then the client rowKey of an
 * unsaved section, and the sheet row only when neither exists.
 */
export function sectionTitleKey(row: ISheet | undefined, rowIndex: number) {
  const id = row?.sectionId?.id;
  if (id) return `title-${id}`;
  if (row?.rowKey) return `title-key-${row.rowKey}`;
  return `title-row-${rowIndex}`;
}
