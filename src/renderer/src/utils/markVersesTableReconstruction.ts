import { IRegion } from '../crud/useWavesurferRegions';
import { PassageD } from '../model';
import { RefStatus } from './markVersesSegmentColors';
import { incrementMarkVersesReferenceSuffix } from './markVersesPassageVerses';
import { markVersesRenumberLeadingRef } from './markVersesEditReference';

export interface ICell {
  value: any;
  readOnly?: boolean;
  width?: number;
  className?: string;
  status?: RefStatus;
  warning?: string;
}

export enum ColName {
  Limits,
  Ref,
}

/** `6:3a`, `6:3a-c` -> `6:3`: the verse a reference starts in, without subparts. */
const baseVerseRef = (reference: string) =>
  reference.replace(/^(\d+:\d+).*$/, '$1');

export interface RebuildMarkVersesTableInput {
  regions: IRegion[];
  previousData: ICell[][];
  autoRefs: string[];
  init: boolean;
  passage: PassageD;
  headerRow: ICell[];
  rowCells: (row: string[]) => ICell[];
  collectRefs: (tableData: ICell[][]) => string[];
  formLim: (region: IRegion) => string;
}

export interface RebuildMarkVersesTableResult {
  /** The rebuilt table. Mutable: the caller still annotates and highlights it. */
  newData: ICell[][];
  /** True when a region label was rewritten, so the segments must be re-pushed
   * to the player. */
  reset: boolean;
}

export const rebuildMarkVersesTable = ({
  regions,
  previousData,
  autoRefs,
  init,
  passage,
  headerRow,
  rowCells,
  collectRefs,
  formLim,
}: RebuildMarkVersesTableInput): RebuildMarkVersesTableResult => {
  const newData = [headerRow];
  const currentLength = previousData.length;
  let reset = false;

  regions.forEach((region, index) => {
    const previousRow =
      index + 1 < currentLength
        ? (previousData[index + 1] as ICell[])
        : undefined;
    const previousReference = previousRow?.[ColName.Ref] as ICell | undefined;
    let nextReference = `${previousReference?.value ?? ''}`;

    if (!nextReference && autoRefs[index]) {
      const priorNewRow = newData[newData.length - 1] as ICell[] | undefined;
      const priorRef = `${priorNewRow?.[ColName.Ref]?.value ?? ''}`;
      const suffixIncrement = priorRef
        ? incrementMarkVersesReferenceSuffix(priorRef)
        : undefined;
      nextReference = suffixIncrement ?? autoRefs[index];
    }
    if (region.label && init) {
      const refsSoFar = collectRefs(newData);
      if (!refsSoFar.includes(region.label)) {
        nextReference = region.label;
      }
    } else if (region.label !== nextReference) {
      region.label = nextReference;
      reset = true;
    }

    const row = rowCells([formLim(region), nextReference]);
    newData.push(row);
  });

  const refs = collectRefs(newData);
  const versesCovered = new Set(refs.map(baseVerseRef));
  const previousRefs = collectRefs(previousData);

  // When the last marked row ends part-way through a verse (e.g. `1:3a`),
  // the derived rows pick up with the rest of that verse (`1:3b`) before
  // the remaining whole verses, unless a row for it already exists.
  const lastMarkedRef = refs[refs.length - 1] ?? '';
  const trailingRef = lastMarkedRef
    ? markVersesRenumberLeadingRef(lastMarkedRef, passage)
    : undefined;
  if (
    trailingRef &&
    !refs.includes(trailingRef) &&
    !previousRefs.includes(trailingRef)
  ) {
    newData.push(rowCells(['', trailingRef]));
  }

  previousData.slice(1).forEach((existingRow, index) => {
    const reference = `${(existingRow[ColName.Ref] as ICell).value ?? ''}`;
    if (!reference || refs.includes(reference)) return;
    if (
      index < newData.length - 1 &&
      versesCovered.has(baseVerseRef(reference))
    )
      return;
    newData.push(rowCells(['', reference]));
  });

  return { newData, reset };
};
