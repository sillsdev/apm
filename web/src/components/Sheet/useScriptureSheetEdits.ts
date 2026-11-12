import { useMemo, type MutableRefObject } from 'react';
import { related } from '../../crud';
import {
  ISheet,
  MediaFileD,
  PassageD,
  SectionD,
  SharedResourceD,
  SheetLevel,
} from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { currentDateTime } from '../../utils/currentDateTime';
import { waitForIt } from '../../utils/waitForIt';
import { applySheetCellChanges } from './applySheetCellChanges';
import { isSectionRow } from './isSectionPassage';
import { shtResequence } from './shtResequence';
import type { ICellChange } from './PlanSheet';
import {
  addPassageTo,
  insertAt,
  movePassageTo,
  movePassageToNextSection,
  moveSectionTo,
  newSection,
  updateRowAt,
} from './sheetRowEdit';
import { getByIndex, getUndelIndex } from './sheetRowIndex';
import { withUpdatedReference } from './withUpdatedReference';

export interface ScriptureSheetEditDeps {
  sheet: ISheet[];
  sheetRef: MutableRefObject<ISheet[]>;
  savingRef: MutableRefObject<boolean>;
  updateRef: MutableRefObject<boolean>;
  setSheet: (ws: ISheet[]) => void;
  setChanged: (value: boolean) => void;
  setUpdate: (value: boolean) => void;
  setSectionArr: (rows: Array<[number, string]>) => void;
  setEditRow: (
    row: ISheet | undefined | ((prev: ISheet | undefined) => ISheet | undefined)
  ) => void;
  showMessage: (msg: string) => void;
  savingMessage: string;
  saveFirstMessage: string;
  nonNumberMessage: string;
  noSaveOfflineMessage: string;
  isChanged: (toolId: string) => boolean;
  toolId: string;
  flat: boolean;
  scripture: boolean;
  firstBook: string;
  shared: boolean;
  publishingTitle: (passageType: PassageTypeEnum) => string;
  graphicFind: (
    passage: PassageD,
    ref: string
  ) =>
    { uri?: string; rights?: string; url?: string; color?: string } | undefined;
  mediafiles: MediaFileD[];
  detachPassage?: (
    passageId: string,
    sectionId: string,
    planId: string,
    mediaId: string,
    forDelete: boolean
  ) => Promise<unknown>;
  plan: string;
  sections: SectionD[];
  offline: boolean;
  offlineOnly: boolean;
  paste: (rows: string[][]) => { valid: boolean; addedWorkflow: ISheet[] };
  colNames: string[];
  secNumCol: number;
  passNumCol: number;
  findBook: (val: string) => string;
}

export function useScriptureSheetEdits(deps: ScriptureSheetEditDeps) {
  const {
    sheet,
    sheetRef,
    savingRef,
    updateRef,
    setSheet,
    setChanged,
    setUpdate,
    setSectionArr,
    setEditRow,
    showMessage,
    savingMessage,
    saveFirstMessage,
    nonNumberMessage,
    noSaveOfflineMessage,
    isChanged,
    toolId,
    flat,
    scripture,
    firstBook,
    shared,
    publishingTitle,
    graphicFind,
    mediafiles,
    detachPassage,
    plan,
    sections,
    offline,
    offlineOnly,
    paste,
    colNames,
    secNumCol,
    passNumCol,
    findBook,
  } = deps;

  const runWhenSheetIdle = (label: string, fn: () => void) => {
    if (savingRef.current || updateRef.current) {
      waitForIt(
        label,
        () => !savingRef.current && !updateRef.current,
        () => false,
        50
      )
        .then(fn)
        .catch(() => showMessage(savingMessage));
      return;
    }
    fn();
  };

  const sheetHasUnsavedChanges = useMemo(
    () => isChanged(toolId),
    [isChanged, toolId]
  );

  const blockWhileSavingOrUpdating = () =>
    savingRef.current || updateRef.current;

  const blockPublishingRows = () =>
    sheetHasUnsavedChanges || blockWhileSavingOrUpdating();

  const showBlockedPublishingMessage = () => {
    if (sheetHasUnsavedChanges) showMessage(saveFirstMessage);
    else showMessage(savingMessage);
  };

  const handleResequence = () => {
    if (savingRef.current || updateRef.current) {
      showMessage(savingMessage);
      return;
    }
    if (updateRef.current) return;
    setUpdate(true);
    const ws = shtResequence(sheetRef.current);
    if (ws !== sheet) {
      setSheet(ws);
      setSectionArr([]);
      setChanged(true);
    }
    setUpdate(false);
  };

  const updatePassageRef = (id: string, val: string, sr?: SharedResourceD) => {
    const ws = sheetRef.current;
    const index = ws.findIndex((s) => s?.passage?.id === id);
    if (index < 0) return;
    const passageRow = { ...ws[index] };
    const nested = updateRef.current;
    if (!nested) setUpdate(true);
    passageRow.reference = val;
    passageRow.passageUpdated = currentDateTime();
    passageRow.sharedResource = sr;
    passageRow.passage = withUpdatedReference(passageRow.passage, val);
    if (passageRow.passageType === PassageTypeEnum.NOTE && passageRow.passage) {
      const gr = graphicFind(passageRow.passage, val);
      passageRow.graphicUri = gr?.uri;
      passageRow.graphicRights = gr?.rights;
      passageRow.graphicFullSizeUrl = gr?.url;
      passageRow.color = gr?.color;
    }
    setSheet(updateRowAt(ws, passageRow, index));
    setEditRow((prev) => (prev?.passage?.id === id ? passageRow : prev));
    if (!nested) setUpdate(false);
  };

  const sheetEdit = { flat, scripture, firstBook, shared };
  const addSection = (
    level: SheetLevel,
    ix?: number,
    ptype?: PassageTypeEnum
  ) => {
    runWhenSheetIdle('finish save or update before add section', () => {
      setUpdate(true);
      const i = getUndelIndex(sheetRef.current, ix);
      let newRow = newSection({
        level,
        sheet: sheetRef.current,
        index: i,
        ...sheetEdit,
      });
      if (ptype === PassageTypeEnum.MOVEMENT) {
        newRow = { ...newRow, reference: publishingTitle(ptype) };
      }
      let newData = insertAt(sheetRef.current, newRow, i);
      if (i !== undefined) newData = shtResequence(newData);
      if (ptype === PassageTypeEnum.MOVEMENT) {
        setSheet(newData);
      } else {
        setSheet(
          addPassageTo({
            level,
            sheet: newData,
            passageType: ptype,
            index: i,
            ...sheetEdit,
          })
        );
      }
      setUpdate(false);
      setChanged(true);
    });
  };

  const addPassage = (
    ptype?: PassageTypeEnum,
    ix?: number,
    before?: boolean
  ) => {
    runWhenSheetIdle('finish save or update before add passage', () => {
      setUpdate(true);
      const i = getUndelIndex(sheetRef.current, ix);
      setSheet(
        addPassageTo({
          level: SheetLevel.Passage,
          sheet: sheetRef.current,
          passageType: ptype,
          index: i,
          before,
          ...sheetEdit,
        })
      );
      setUpdate(false);
      setChanged(true);
    });
  };

  const movePassage = (ix: number, before: boolean, nextSection: boolean) => {
    if (savingRef.current || updateRef.current) {
      showMessage(savingMessage);
      return;
    }
    if (flat) return;
    setUpdate(true);
    const i = getUndelIndex(sheetRef.current, ix);
    if (i !== undefined) {
      if (nextSection) {
        const nextSheet = movePassageToNextSection({
          sheet: sheetRef.current,
          index: i,
          before,
          flat,
        });
        if (nextSheet) setSheet(nextSheet);
      } else setSheet(movePassageTo(sheetRef.current, i, before, flat));
      setChanged(true);
    }
    setUpdate(false);
  };

  const moveSection = (ix: number, before: boolean) => {
    if (savingRef.current) {
      showMessage(savingMessage);
      return;
    }
    if (savingRef.current || updateRef.current) {
      showMessage(savingMessage);
      return;
    }
    setUpdate(true);
    setSectionArr([]);
    const i = getUndelIndex(sheetRef.current, ix);
    if (i !== undefined) {
      setSheet(moveSectionTo(sheetRef.current, i, before));
      setChanged(true);
    }
    setUpdate(false);
  };

  const doDetachMedia = async (ws: ISheet | undefined) => {
    if (!ws) return false;
    if (ws.passage) {
      const attached = mediafiles.filter(
        (m) => related(m, 'passage') === ws.passage?.id
      ) as MediaFileD[];
      if (detachPassage) {
        for (let ix = 0; ix < attached.length; ix++) {
          await detachPassage(
            ws.passage?.id || '',
            related(ws.passage, 'section'),
            plan,
            (attached[ix] as MediaFileD).id,
            true
          );
        }
      }
    }
    return true;
  };

  const markDelete = async (index: number) => {
    if (savingRef.current || updateRef.current) {
      showMessage(savingMessage);
      return;
    }
    setUpdate(true);
    const { ws, i } = getByIndex(sheetRef.current, index);
    const removeItem: number[] = [];

    const doDelete = (sht: ISheet[], j: number, isSec?: boolean) => {
      if (
        (isSec && (sht[j] as ISheet).sectionId) ||
        (!isSec && (sht[j] as ISheet).passage)
      ) {
        sht[j] = { ...sht[j], deleted: true } as ISheet;
      } else {
        removeItem.push(j);
      }
    };

    if (ws) {
      const newsht = [...sheetRef.current];
      if (isSectionRow(ws)) {
        let j = i;
        let isSec = true;
        while (j < newsht.length) {
          doDelete(newsht, j, isSec);
          j += 1;
          isSec = false;
          if (j === newsht.length) break;
          if (isSectionRow(newsht[j] as ISheet)) break;
        }
      } else doDelete(newsht, i);
      const myWork: ISheet[] = [];
      newsht.forEach((row, rowIndex) => {
        if (!removeItem.includes(rowIndex)) myWork.push(row);
      });
      setSheet([...shtResequence(myWork)]);
      setChanged(true);
    }
    setUpdate(false);
  };

  const handleDelete = async (what: string, where: number[]) => {
    if (what === 'Delete') {
      await waitForIt(
        'saving before delete',
        () => {
          return !savingRef.current;
        },
        () => false,
        1500
      );
      await markDelete(where[0] ?? 0);
      return true;
    }
    return false;
  };

  const getScheme = (where: number[]) => {
    const { ws } = getByIndex(sheetRef.current, where[0] ?? 0);
    return ws?.scheme?.id;
  };

  const getSectionsWhere = (where: number[]) => {
    const selected = Array<SectionD>();
    where.forEach((c) => {
      const { ws } = getByIndex(sheetRef.current, c);
      const one = sections.find((s) => s.id === ws?.sectionId?.id);
      if (one) selected.push(one);
    });
    return selected;
  };

  const handleTablePaste = (rows: string[][]) => {
    if (savingRef.current || updateRef.current) {
      showMessage(savingMessage);
      return Array<Array<string>>();
    }
    if (offline && !offlineOnly) {
      showMessage(noSaveOfflineMessage);
      return Array<Array<string>>();
    }
    setUpdate(true);
    const { valid, addedWorkflow } = paste(rows);
    if (valid) {
      setSheet(sheetRef.current.concat(addedWorkflow));
      setChanged(true);
      setUpdate(false);
      return Array<Array<string>>();
    }
    setUpdate(false);
    return rows;
  };

  const applyCellChanges = (changes: ICellChange[]) => {
    setUpdate(true);
    const { sheet: newsht, invalidNumberCount } = applySheetCellChanges({
      sheet: sheetRef.current,
      changes,
      colNames,
      sectionNumCol: secNumCol,
      passageNumCol: passNumCol,
      flat,
      findBook,
    });
    for (let n = 0; n < invalidNumberCount; n += 1)
      showMessage(nonNumberMessage);
    if (changes.length > 0) {
      setSheet(newsht);
      setChanged(true);
    }
    setUpdate(false);
  };

  const updateData = (changes: ICellChange[]) => {
    if (savingRef.current || updateRef.current) {
      waitForIt(
        'finish save or update',
        () => !savingRef.current && !updateRef.current,
        () => false,
        50
      ).then(() => applyCellChanges(changes));
      return;
    }
    applyCellChanges(changes);
  };

  return {
    sheetHasUnsavedChanges,
    blockPublishingRows,
    blockWhileSavingOrUpdating,
    showBlockedPublishingMessage,
    handleResequence,
    updatePassageRef,
    addSection,
    addPassage,
    movePassage,
    moveSection,
    doDetachMedia,
    handleDelete,
    getScheme,
    getSectionsWhere,
    handleTablePaste,
    updateData,
  };
}
