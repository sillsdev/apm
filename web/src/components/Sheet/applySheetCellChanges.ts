import { ISheet } from '../../model';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { currentDateTime } from '../../utils/currentDateTime';
import { getByIndex } from './sheetRowIndex';
import { withUpdatedReference } from './withUpdatedReference';

export interface SheetCellEdit {
  row: number;
  col: number;
  value: string | null;
}

interface SheetRecord extends ISheet {
  [key: string]: unknown;
}

export function isValidSheetNumber(value: string): boolean {
  return /^-?[0-9.]+$/.test(value);
}

export interface ApplySheetCellChangesResult {
  sheet: ISheet[];
  invalidNumberCount: number;
}

export function applySheetCellChanges(options: {
  sheet: ISheet[];
  changes: SheetCellEdit[];
  colNames: string[];
  sectionNumCol: number;
  passageNumCol: number;
  flat: boolean;
  findBook: (val: string) => string;
  now?: () => string;
}): ApplySheetCellChangesResult {
  const now = options.now ?? currentDateTime;
  const { changes, colNames, sectionNumCol, passageNumCol, flat, findBook } =
    options;
  const newsht = [...options.sheet];
  let invalidNumberCount = 0;
  changes.forEach((c) => {
    const { ws, i } = getByIndex(newsht, c.row);
    const myWf = ws as SheetRecord | undefined;
    const name = colNames[c.col];
    const isNumberCol = c.col === sectionNumCol || c.col === passageNumCol;

    if (isNumberCol && !isValidSheetNumber(c.value || '')) {
      invalidNumberCount += 1;
    } else if (myWf && myWf[name as keyof SheetRecord] !== c.value) {
      const isSection = c.col < 2;
      const sectionUpdated = isSection ? now() : ws?.sectionUpdated;
      const passageUpdated = isSection ? ws?.passageUpdated : now();
      const value = name === 'book' ? findBook(c.value as string) : c.value;
      const passageType =
        name === 'reference'
          ? passageTypeFromRef(c.value as string, flat)
          : ws?.passageType;
      const passage =
        name === 'reference'
          ? withUpdatedReference(ws?.passage, c.value as string)
          : ws?.passage;

      newsht[i] = {
        ...ws,
        [name as keyof SheetRecord]: isNumberCol
          ? Number.parseInt(value ?? '')
          : value,
        sectionUpdated,
        passageUpdated,
        passageType,
        passage,
      } as ISheet;
    }
  });
  return { sheet: newsht, invalidNumberCount };
}
