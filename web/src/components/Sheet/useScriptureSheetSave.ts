import { useEffect, type MutableRefObject } from 'react';
import Memory from '@orbit/memory';
import {
  IScriptureTableStrings,
  ISharedStrings,
  ISheet,
  PassageD,
  SectionD,
} from '../../model';
import { currentDateTime } from '../../utils/currentDateTime';
import { waitForIt } from '../../utils/waitForIt';
import { bumpUpdatedStamp } from './bumpUpdatedStamp';
import { isPassageRow, isSectionRow } from './isSectionPassage';
import { shtNumChanges } from './shtNumChanges';
import {
  createPendingTitleMediaQueue,
  type TitleMediaPending,
} from './pendingTitleMediaQueue';
import { getByIndex } from './sheetRowIndex';
import { resolveTitleMediaRowIndex } from './resolveTitleMediaRowIndex';

export interface ScriptureSheetSaveDeps {
  sheetRef: MutableRefObject<ISheet[]>;
  savingRef: MutableRefObject<boolean>;
  updateRef: MutableRefObject<boolean>;
  myChangedRef: MutableRefObject<boolean>;
  lastSavedRef: MutableRefObject<string | undefined>;
  titleSaveTimer: MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  titleMediaApplyRef: MutableRefObject<(pending: TitleMediaPending) => void>;
  titleMediaQueueRef: MutableRefObject<ReturnType<
    typeof createPendingTitleMediaQueue
  > | null>;
  doForceDataChanges: MutableRefObject<boolean>;
  sheetSavePipelineRef: MutableRefObject<boolean>;
  setSheet: (ws: ISheet[]) => void;
  setChanged: (value: boolean) => void;
  setUpdate: (value: boolean) => void;
  setLastSaved: (value: string | undefined) => void;
  setComplete: (value: number) => void;
  setBusy: (value: boolean) => void;
  showMessage: (msg: string) => void;
  t: IScriptureTableStrings;
  ts: ISharedStrings;
  toolId: string;
  firstMovement: number;
  projFirstMovement: number;
  setProjectDefault: (key: string, value: unknown) => void;
  projDefFirstMovement: string;
  doDetachMedia: (ws: ISheet | undefined) => Promise<unknown>;
  memory: Memory;
  offlineOnly: boolean;
  onlineSave: (sheet: ISheet[], prevSave: string) => Promise<unknown>;
  localSave: (
    sheet: ISheet[],
    sections: SectionD[],
    passages: PassageD[],
    prevSave: string
  ) => Promise<unknown>;
  updateLastModified: () => Promise<void>;
  saveCompleted: (toolId: string, err?: string) => void;
  saveRequested: (toolId: string) => boolean;
  clearRequested: (toolId: string) => boolean;
  clearCompleted: (toolId: string) => void;
  isChanged: (toolId: string) => boolean;
  anySaving: (toolId: string) => boolean;
  startSave: (toolId?: string) => void;
  checkOnline: (cb: (online: boolean) => void) => void;
  waitForRemoteQueue: (msg: string) => Promise<unknown>;
  forceDataChanges: () => void;
  toolsChanged: unknown;
  lastSaved: string | undefined;
}

export function useScriptureSheetSave(deps: ScriptureSheetSaveDeps) {
  const {
    sheetRef,
    savingRef,
    updateRef,
    myChangedRef,
    lastSavedRef,
    titleSaveTimer,
    titleMediaApplyRef,
    titleMediaQueueRef,
    doForceDataChanges,
    sheetSavePipelineRef,
    setSheet,
    setChanged,
    setUpdate,
    setLastSaved,
    setComplete,
    setBusy,
    showMessage,
    t,
    ts,
    toolId,
    firstMovement,
    projFirstMovement,
    setProjectDefault,
    projDefFirstMovement,
    doDetachMedia,
    memory,
    offlineOnly,
    onlineSave,
    localSave,
    updateLastModified,
    saveCompleted,
    saveRequested,
    clearRequested,
    clearCompleted,
    isChanged,
    anySaving,
    startSave,
    checkOnline,
    waitForRemoteQueue,
    forceDataChanges,
    toolsChanged,
    lastSaved,
  } = deps;

  titleMediaApplyRef.current = (pending: TitleMediaPending) => {
    setUpdate(true);
    const newsht = [...sheetRef.current];
    const i = resolveTitleMediaRowIndex(newsht, pending);
    const ws = i >= 0 && i < newsht.length ? newsht[i] : undefined;
    if (!ws) {
      setUpdate(false);
      return;
    }
    if (isSectionRow(ws)) {
      const sectionUpdated = bumpUpdatedStamp(
        ws.sectionUpdated,
        lastSavedRef.current
      );
      newsht[i] = {
        ...ws,
        titleMediaId: pending.mediaId
          ? { type: 'mediafile', id: pending.mediaId }
          : undefined,
        sectionUpdated,
      } as ISheet;
      setSheet(newsht);
      setChanged(true);
    } else if (isPassageRow(ws)) {
      // CHNUM / passage-only rows — do not run after section branch:
      // SectionPassage would otherwise overwrite titleMediaId (TT-7660).
      const passageUpdated = bumpUpdatedStamp(
        ws.passageUpdated,
        lastSavedRef.current
      );
      newsht[i] = {
        ...ws,
        mediaId: pending.mediaId
          ? { type: 'mediafile', id: pending.mediaId }
          : undefined,
        passageUpdated,
      } as ISheet;
      setSheet(newsht);
      setChanged(true);
    }
    setUpdate(false);
  };

  const getTitleMediaQueue = () => {
    if (!titleMediaQueueRef.current) {
      titleMediaQueueRef.current = createPendingTitleMediaQueue({
        isBusy: () => savingRef.current || updateRef.current,
        whenIdle: (fn) => {
          // Retry forever on wait timeout — never drop title-media updates (TT-7660).
          const tryWait = (): Promise<void> => {
            if (!savingRef.current && !updateRef.current) {
              fn();
              return Promise.resolve();
            }
            return waitForIt(
              'finish save or update before title media',
              () => !savingRef.current && !updateRef.current,
              () => false,
              50
            )
              .then(() => {
                fn();
              })
              .catch(() => {
                showMessage(t.saving);
                return tryWait();
              });
          };
          return tryWait();
        },
        applyOne: (item) => titleMediaApplyRef.current(item),
        requestSave: () => {
          if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
          // Only the sheet tool — bare startSave() marks every dirty tool,
          // including MediaTitle-*rec mid-recording, which surfaces as
          // NoSaveWoMedia ("check your internet") with no failed network call.
          titleSaveTimer.current = setTimeout(() => startSave(toolId), 1000);
        },
      });
    }
    return titleMediaQueueRef.current;
  };

  const updateTitleMedia = async (index: number, mediaId: string) => {
    const { ws } = getByIndex(sheetRef.current, index);
    const pending: TitleMediaPending = {
      index,
      mediaId,
      sectionId: ws?.sectionId?.id,
      passageId: ws?.passage?.id,
      rowKey: ws?.rowKey,
      label: ws?.title,
    };
    getTitleMediaQueue().enqueue(pending);
  };

  // Save locally or online in batches
  useEffect(() => {
    let prevSave = '';
    const handleSave = async () => {
      const numChanges = shtNumChanges(sheetRef.current, prevSave);
      if (firstMovement !== projFirstMovement)
        setProjectDefault(projDefFirstMovement, firstMovement);
      if (numChanges === 0) return;
      for (const ws of sheetRef.current) {
        if (ws.deleted) await doDetachMedia(ws);
      }
      setComplete(10);
      const saveFn = async (sheet: ISheet[]) => {
        // Prefer Orbit cache over closed-over React lists — publishing rows
        // can exist on the sheet before the sections prop catches up (TT-7660).
        const freshSections = memory.cache.query((q) =>
          q.findRecords('section')
        ) as SectionD[];
        const freshPassages = memory.cache.query((q) =>
          q.findRecords('passage')
        ) as PassageD[];
        if (!offlineOnly && numChanges > 10) {
          return await onlineSave(sheet, prevSave);
        }
        await localSave(sheet, freshSections, freshPassages, prevSave);
        return false;
      };
      if (numChanges > 50) setBusy(true);
      const newsht = [...sheetRef.current];
      await saveFn(newsht);
      //update plan section count and lastmodified
      await updateLastModified();
      setBusy(false);
    };
    const setSaving = (value: boolean) => (savingRef.current = value);
    const doneSavingSuccess = () => {
      setSaving(false);
      setChanged(false);
      setLastSaved(currentDateTime()); // force refresh the sheet from saved data
      saveCompleted(toolId);
      setComplete(100);
      setUpdate(false);
      sheetSavePipelineRef.current = false;
    };
    const doneSavingFailure = (saveErr: string) => {
      setSaving(false);
      setUpdate(false);
      setBusy(false);
      saveCompleted(toolId, saveErr);
      setComplete(100);
      showMessage(saveErr);
      sheetSavePipelineRef.current = false;
    };
    const finishAfterSave = () => {
      if (doForceDataChanges.current) {
        doForceDataChanges.current = false;
        waitForRemoteQueue(t.publishingWarning)
          .then(() => forceDataChanges())
          .catch(() => {})
          .finally(() => doneSavingSuccess());
      } else {
        doneSavingSuccess();
      }
    };
    const save = () => {
      if (savingRef.current || updateRef.current) {
        waitForIt(
          'finish save or update',
          () => !savingRef.current && !updateRef.current,
          () => false,
          50
        )
          .then(() => save())
          .catch(() => {
            doneSavingFailure(ts.TooBusy);
          });
        return;
      }
      setSaving(true);
      setUpdate(true);
      prevSave = lastSaved || '';
      showMessage(t.saving);
      handleSave()
        .then(finishAfterSave)
        .catch(() => doneSavingFailure(ts.NoSaveWoMedia));
    };
    myChangedRef.current = isChanged(toolId);
    if (saveRequested(toolId)) {
      // MediaTitle (and other tools) clearing dirty state re-fires toolsChanged
      // while scriptureTable startSave is still set — without this guard we
      // launch a second save with the same prevSave (TT-7660).
      if (sheetSavePipelineRef.current) return;
      sheetSavePipelineRef.current = true;
      //wait a beat for the save to register
      setTimeout(() => {
        waitForIt(
          'saving sheet recordings',
          () => !anySaving(toolId) && !updateRef.current,
          () => false,
          10000
        ).finally(() => {
          if (offlineOnly) {
            save();
          } else {
            checkOnline((online) => {
              if (!online) {
                saveCompleted(toolId, ts.NoSaveOffline);
                showMessage(ts.NoSaveOffline);
                setSaving(false);
                setUpdate(false);
                sheetSavePipelineRef.current = false;
              } else {
                save();
              }
            });
          }
        });
      }, 100);
    } else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  return { updateTitleMedia };
}
