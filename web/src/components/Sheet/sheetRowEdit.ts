import { IMediaShare, ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { PublishDestinationEnum } from '../../crud/usePublishDestination';
import { currentDateTime } from '../../utils/currentDateTime';
import { generateUUID } from '../../utils/generateUUID';
import { isSectionRow } from './isSectionPassage';
import { findSection } from './sheetRowIndex';
import { nextNum, wfResequencePassages } from './shtResequence';

const NoSkip = false;

export function insertAt<T>(arr: T[], item: T, index?: number): T[] {
  if (index === undefined) {
    return [...arr.concat([item])];
  } else {
    const newArr = arr.map((v, i) =>
      i < index ? v : i === index ? item : arr[i - 1]
    );
    // pop() mutates arr and is undefined only for an empty list. Callers
    // insert into a sheet that already has rows.
    const last = arr.pop() as T;
    return [...newArr.concat([last])];
  }
}

export function updateRowAt<T>(arr: T[], item: T, index: number): T[] {
  const newArr = arr.map((v, i) =>
    i < index ? v : i === index ? item : arr[i]
  );
  return newArr;
}

export function isPassageOrNote(ws: ISheet[], i: number): boolean {
  return [PassageTypeEnum.PASSAGE, PassageTypeEnum.NOTE].includes(
    (ws[i] as ISheet).passageType
  );
}

export function swapRows(myWorkflow: ISheet[], i: number, j: number): ISheet[] {
  const passageRow = { ...myWorkflow[i] };
  const swapRow = { ...myWorkflow[j] };
  return updateRowAt(updateRowAt(myWorkflow, passageRow, j), swapRow, i);
}

export function movePassageTo(
  myWorkflow: ISheet[],
  i: number,
  before: boolean,
  flat: boolean
): ISheet[] {
  const mySectionIndex = findSection(myWorkflow, i, true, NoSkip);
  myWorkflow = swapRows(myWorkflow, i, before ? i - 1 : i + 1);
  return wfResequencePassages(myWorkflow, mySectionIndex, flat);
}

export function moveSectionTo(
  myWorkflow: ISheet[],
  i: number,
  before: boolean,
  now: () => string = currentDateTime
): ISheet[] {
  const swapSectionIndex = findSection(
    myWorkflow,
    before ? i - 1 : i + 1,
    before,
    NoSkip
  );

  const firstIndex = before ? swapSectionIndex : i;
  const secondIndex = before ? i : swapSectionIndex;
  let firstNum = (myWorkflow[firstIndex] as ISheet).sectionSeq;
  let secondNum = (myWorkflow[secondIndex] as ISheet).sectionSeq;

  const firstIsMovement =
    (myWorkflow[firstIndex] as ISheet).passageType === PassageTypeEnum.MOVEMENT;
  const secondIsMovement =
    (myWorkflow[secondIndex] as ISheet).passageType ===
    PassageTypeEnum.MOVEMENT;
  if (firstIsMovement !== secondIsMovement) {
    if (firstIsMovement) {
      secondNum = nextNum(
        (myWorkflow[secondIndex] as ISheet).sectionSeq,
        PassageTypeEnum.MOVEMENT
      );
      firstNum = (myWorkflow[secondIndex] as ISheet).sectionSeq;
    } else {
      firstNum = nextNum(
        firstIndex > 0 ? (myWorkflow[firstIndex - 1] as ISheet).sectionSeq : 0,
        PassageTypeEnum.MOVEMENT
      );
      secondNum = (myWorkflow[firstIndex] as ISheet).sectionSeq;
    }
  }
  (myWorkflow[firstIndex] as ISheet).sectionSeq = secondNum;
  (myWorkflow[firstIndex] as ISheet).sectionUpdated = now();
  for (
    let ix = firstIndex + 1;
    ix < myWorkflow.length &&
    (myWorkflow[ix] as ISheet).sectionSeq === firstNum;
    ix++
  ) {
    (myWorkflow[ix] as ISheet).sectionSeq = secondNum;
    (myWorkflow[ix] as ISheet).passageUpdated = now();
  }
  (myWorkflow[secondIndex] as ISheet).sectionSeq = firstNum;
  (myWorkflow[secondIndex] as ISheet).sectionUpdated = now();
  for (
    let ix = secondIndex + 1;
    ix < myWorkflow.length &&
    (myWorkflow[ix] as ISheet).sectionSeq === secondNum;
    ix++
  ) {
    (myWorkflow[ix] as ISheet).sectionSeq = firstNum;
    (myWorkflow[ix] as ISheet).passageUpdated = now();
  }

  const sorted = [...myWorkflow].sort((a, b) => a.sectionSeq - b.sectionSeq);
  return sorted;
}

export function updatePassageSeq(
  ws: ISheet[],
  i: number,
  val: number,
  now: () => string = currentDateTime
): ISheet[] {
  const passageRow = { ...ws[i] };
  passageRow.sectionSeq = val;
  passageRow.passageUpdated = now();
  return updateRowAt(ws, passageRow, i);
}

export function movePassageToNextSection(options: {
  sheet: ISheet[];
  index: number;
  before: boolean;
  flat: boolean;
  now?: () => string;
}): ISheet[] | undefined {
  const now = options.now ?? currentDateTime;
  let myWorkflow = options.sheet;
  let i = options.index;
  const { before, flat } = options;
  const skipPublishing =
    (myWorkflow[i] as ISheet).passageType === PassageTypeEnum.PASSAGE;
  const originalSectionIndex = findSection(
    myWorkflow,
    i,
    before,
    skipPublishing
  );
  const newSectionIndex = findSection(
    myWorkflow,
    before ? originalSectionIndex - 1 : i,
    before,
    skipPublishing
  );
  if (newSectionIndex < 0) return;
  const newSeqVal = (myWorkflow[newSectionIndex] as ISheet).sectionSeq;
  myWorkflow = updatePassageSeq(myWorkflow, i, newSeqVal, now);
  let endRowIndex = newSectionIndex;

  if (before) {
    while (
      ++endRowIndex < myWorkflow.length &&
      !isSectionRow(myWorkflow[endRowIndex] as ISheet)
    ) {
      // intentionally empty
    }
    while (i > endRowIndex) {
      myWorkflow = swapRows(myWorkflow, i, i - 1);
      i--;
    }
    myWorkflow = wfResequencePassages(
      wfResequencePassages(myWorkflow, originalSectionIndex + 1, flat),
      newSectionIndex,
      flat
    );
  } else {
    while (
      endRowIndex < myWorkflow.length - 2 &&
      ((myWorkflow[endRowIndex] as ISheet).deleted ||
        !isPassageOrNote(myWorkflow, endRowIndex + 1))
    )
      endRowIndex++;
    while (i < endRowIndex) {
      myWorkflow = swapRows(myWorkflow, i, i + 1);
      i++;
    }
    myWorkflow = wfResequencePassages(
      wfResequencePassages(myWorkflow, originalSectionIndex, flat),
      newSectionIndex - 1,
      flat
    );
  }

  return myWorkflow;
}

export interface SheetEditContext {
  flat: boolean;
  scripture: boolean;
  firstBook: string;
  shared: boolean;
  now?: () => string;
}

export function nextSecSequence(
  ws: ISheet[],
  i?: number,
  flattype?: PassageTypeEnum
): number {
  const sequenceNums = ws.map((row, j) =>
    !i || j < i ? (!row.deleted && row.sectionSeq) || 0 : 0
  ) as number[];
  return nextNum(Math.max(...sequenceNums, 0), flattype);
}

export function newSection(
  options: SheetEditContext & {
    level: SheetLevel;
    sheet: ISheet[];
    index?: number;
    passageType?: PassageTypeEnum;
  }
): ISheet {
  const now = options.now ?? currentDateTime;
  const { level, sheet, index, passageType, flat, scripture, firstBook } =
    options;
  const newRow = {
    level,
    kind: flat ? IwsKind.SectionPassage : IwsKind.Section,
    sectionSeq: nextSecSequence(sheet, index, passageType),
    passageSeq: 0,
    reference: '',
    published: [] as PublishDestinationEnum[],
    book: scripture ? firstBook : '',
    sectionUpdated: now(),
    rowKey: generateUUID(),
  } as ISheet;
  return newRow;
}

export function addPassageTo(
  options: SheetEditContext & {
    level: SheetLevel;
    sheet: ISheet[];
    passageType?: PassageTypeEnum;
    index?: number;
    /** Accepted so callers can keep passing it. The insert path does not read it. */
    before?: boolean;
    title?: string;
    reference?: string;
  }
): ISheet[] {
  const now = options.now ?? currentDateTime;
  const {
    level,
    passageType: ptype,
    title,
    reference,
    flat,
    scripture,
    firstBook,
    shared,
  } = options;
  let myWorkflow = options.sheet;
  const i = options.index;
  let lastRow = myWorkflow.length - 1;
  while (lastRow >= 0 && (myWorkflow[lastRow] as ISheet).deleted) lastRow -= 1;
  let index = i === undefined && lastRow >= 0 ? lastRow : i || 0;
  const newRow = {
    ...myWorkflow[index],
    level: flat && level ? level : SheetLevel.Passage,
    kind: flat ? IwsKind.SectionPassage : IwsKind.Passage,
    book: scripture ? firstBook : '',
    reference: reference ?? ptype ?? '',
    mediaId: undefined,
    comment: title ?? '',
    passageUpdated: now(),
    passage: undefined,
    passageType: ptype ?? PassageTypeEnum.PASSAGE,
    mediaShared: shared ? IMediaShare.None : IMediaShare.NotPublic,
    sharedResource: undefined,
    graphicUri: undefined,
    graphicRights: undefined,
    graphicFullSizeUrl: undefined,
    color: undefined,
    deleted: false,
    filtered: false,
    rowKey: generateUUID(),
  } as ISheet;

  if (flat && isSectionRow(myWorkflow[index] as ISheet)) {
    myWorkflow = wfResequencePassages(
      updateRowAt(myWorkflow, newRow, index),
      index,
      flat
    );
    return myWorkflow;
  } else {
    myWorkflow = insertAt(
      myWorkflow,
      newRow,
      index < lastRow ? index + 1 : undefined
    );
    while (index >= 0 && !isSectionRow(myWorkflow[index] as ISheet)) index -= 1;
    return wfResequencePassages(myWorkflow, index, flat);
  }
}
