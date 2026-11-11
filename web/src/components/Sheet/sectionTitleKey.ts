import type { ISheet } from '../../model';

/**
 * Cell key for a section title: the client rowKey of a row added in this
 * session, the section id of a loaded row, and the sheet row only when neither
 * exists. rowKey comes first because the first save gives a new row a section
 * id but keeps its rowKey, and a key change then would remount the title
 * while the user is typing in it.
 */
export function sectionTitleKey(row: ISheet | undefined, rowIndex: number) {
  if (row?.rowKey) return `title-key-${row.rowKey}`;
  const id = row?.sectionId?.id;
  if (id) return `title-${id}`;
  return `title-row-${rowIndex}`;
}
