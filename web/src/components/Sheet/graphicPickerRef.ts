import { ISheet } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { refNumPat } from '../../utils/refNumPat';

export function computeGraphicRef(ref: string): string {
  const m = refNumPat.exec(ref);
  if (m) return m[1];
  return ref;
}

export function graphicPickerRefString(options: {
  row: ISheet | undefined;
  flat: boolean;
  firstBook: string;
  verseCounts: Map<string, number[]>;
  noteRef: string;
  movementRef: string;
  sectionRef: string;
}): string {
  const {
    row,
    flat,
    firstBook,
    verseCounts,
    noteRef,
    movementRef,
    sectionRef,
  } = options;
  const passageType = passageTypeFromRef(row?.reference ?? '', flat);
  if (passageType === PassageTypeEnum.NOTE) {
    if (row?.passage) {
      const computed = computeGraphicRef(noteRef);
      if (computed.length > 0) return computed;
    }
  } else if (passageType === PassageTypeEnum.MOVEMENT) {
    const computed = computeGraphicRef(movementRef);
    if (computed.length > 0) return computed;
  } else if (passageType === PassageTypeEnum.CHAPTERNUMBER) {
    const chapter = (row?.reference ?? '').match(/(\d+)$/);
    const chapNum = chapter ? Number.parseInt(chapter[1]) : undefined;
    const verses = verseCounts.get(firstBook);
    if (verses && chapNum && chapNum < verses.length) {
      return `${firstBook} ${chapNum}:1-${verses[chapNum - 1]}`;
    }
    return firstBook + ' ' + (chapter?.[1] ?? '1') + ':1-999';
  } else if (
    [PassageTypeEnum.BOOK, PassageTypeEnum.ALTBOOK].includes(passageType)
  ) {
    const verses = verseCounts.get(firstBook);
    if (verses) {
      return (
        firstBook + ' 1:1-' + verses.length + ':' + verses[verses.length - 1]
      );
    }
    return firstBook + ' 1:1-999:999';
  }
  return computeGraphicRef(sectionRef);
}
