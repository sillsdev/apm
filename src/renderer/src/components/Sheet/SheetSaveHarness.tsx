/**
 * Thin CT harness for Sections & Passages save pipeline (TT-7416 / TT-6918 / TT-6919).
 * Wires real UnsavedProvider + useWfOnlineSave without mounting full ScriptureTable.
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { UnsavedContext } from '../../context/UnsavedContext';
import { ISheet } from '../../model';
import { useWfPaste } from './useSheetPaste';
import { useWfOnlineSave } from './useSheetOnlineSave';
import { shtNumChanges } from './shtNumChanges';
import { isSectionRow } from './isSectionPassage';
import {
  hierarchicalLukePasteRows,
  sheetPasteColNames,
} from '../../__tests__/fixtures/hierarchicalLukePaste';
import {
  genesisPasteTrimmed,
  findGenesisBook,
} from '../../__tests__/fixtures/genesisPasteTrimmed';
import { existingPopulatedSheet } from '../../__tests__/helpers/sheetSaveTestHarness';
import { publishApmTestState } from '../../../cypress/support/sheetSaveMocks';
import { currentDateTime } from '../../utils/currentDateTime';

const findLukeBook = (val: string) => (/LUK/i.test(val) ? 'LUK' : '');

const pasteStrings = {
  book: 'Book',
  description: 'Description',
  extras: 'Extras',
  installAudacity: 'installAudacity',
  loadingTable: 'Loading data',
  passage: 'Passage',
  pasteInvalidBooks: 'Invalid book: {0}',
  pasteInvalidColumns:
    'Invalid number of columns ({0}). Expecting {1}} columns.',
  pasteInvalidPassageBeforeSection: 'Passage before section {0}',
  pasteInvalidSections: 'Invalid {0} number(s):',
  pasteNoRows: 'No Rows in clipboard.',
  reference: 'Reference',
  saveFirst: 'You must save changes first!',
  saving: 'Saving...',
  title: 'Title',
} as never;

interface Props {
  preloadPopulated?: boolean;
  pasteGenesis?: boolean;
}

export function SheetSaveHarness({
  preloadPopulated = false,
  pasteGenesis = false,
}: Props) {
  const toolId = 'scriptureTable';
  const [, setComplete] = useGlobal('progress');
  const [remoteBusy, setRemoteBusy] = useGlobal('remoteBusy');
  const [progress] = useGlobal('progress');
  const {
    state: {
      toolChanged,
      startSave,
      saveCompleted,
      saveRequested,
      checkSavedFn,
      toolsChanged,
      isChanged,
    },
  } = useContext(UnsavedContext);
  const dirty = isChanged(toolId);

  const [sheet, setSheet] = useState<ISheet[]>(() =>
    preloadPopulated ? existingPopulatedSheet() : []
  );
  const [hasChanges, setHasChanges] = useState(false);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const paste = useWfPaste({
    secNumCol: sheetPasteColNames.indexOf('sectionSeq'),
    passNumCol: sheetPasteColNames.indexOf('passageSeq'),
    scripture: true,
    flat: false,
    shared: false,
    colNames: sheetPasteColNames,
    findBook: pasteGenesis ? findGenesisBook : findLukeBook,
    t: pasteStrings,
  });

  const onlineSave = useWfOnlineSave({ setComplete });

  const handlePaste = useCallback(() => {
    const rows = pasteGenesis ? genesisPasteTrimmed : hierarchicalLukePasteRows;
    const { valid, addedWorkflow } = paste(rows);
    if (valid) {
      setSheet((prev) => [...prev, ...addedWorkflow]);
      toolChanged(toolId, true);
      setHasChanges(true);
    }
  }, [paste, pasteGenesis, toolChanged]);

  const handleDeleteAll = useCallback(() => {
    const now = currentDateTime();
    setSheet((prev) =>
      prev.map((row) => ({
        ...row,
        deleted: true,
        sectionUpdated: isSectionRow(row) ? now : row.sectionUpdated,
        passageUpdated: !isSectionRow(row) ? now : row.passageUpdated,
      }))
    );
    toolChanged(toolId, true);
    setHasChanges(true);
  }, [toolChanged]);

  const handleSave = () => startSave(toolId);

  useEffect(() => {
    const runSave = async () => {
      const numChanges = shtNumChanges(sheetRef.current, '');
      if (numChanges === 0) return;
      setRemoteBusy(true);
      let start = 0;
      const newsht = [...sheetRef.current];
      const saveBatch = async (batch: ISheet[]) => {
        await onlineSave(batch, '');
      };
      if (numChanges > 10) {
        let end = 200;
        for (; start + 200 < newsht.length; start += end) {
          end = 200;
          while (!isSectionRow(newsht[start + end]) && end > 0) end -= 1;
          if (end === 0) {
            end = 200;
            while (end < newsht.length && !isSectionRow(newsht[start + end])) {
              end++;
            }
          }
          await saveBatch(newsht.slice(start, start + end));
        }
      }
      await saveBatch(newsht.slice(start));
      setSheet([...sheetRef.current]);
      saveCompleted(toolId);
      setHasChanges(false);
      setRemoteBusy(false);
      setComplete(100);
      setTimeout(() => setComplete(0), 0);
    };

    if (saveRequested(toolId)) {
      void runSave().catch(() => {
        // Leave remoteBusy true to mirror TT-7416 save hang when keyMap never updates.
        publishApmTestState({
          remoteBusy: true,
          changed: true,
          progress: progress ?? 0,
        });
      });
    }
  }, [
    toolsChanged,
    onlineSave,
    saveCompleted,
    setRemoteBusy,
    setComplete,
    toolId,
    saveRequested,
    progress,
  ]);

  useEffect(() => {
    const firstSection = sheet.find(
      (row) => isSectionRow(row) && row.sectionId?.id
    );
    publishApmTestState({
      remoteBusy: Boolean(remoteBusy),
      changed: dirty || hasChanges,
      progress: progress ?? 0,
      firstSectionId: firstSection?.sectionId?.id,
    });
  }, [sheet, remoteBusy, dirty, hasChanges, progress]);

  return (
    <div>
      <button type="button" id="sheetPasteTrigger" onClick={handlePaste}>
        Paste
      </button>
      {preloadPopulated && (
        <button type="button" id="sheetDeleteAll" onClick={handleDeleteAll}>
          Delete all
        </button>
      )}
      <button
        type="button"
        id="planSheetSave"
        disabled={remoteBusy || !(dirty || hasChanges)}
        onClick={handleSave}
      >
        Save
      </button>
      <button
        type="button"
        id="testNavigateHome"
        onClick={() =>
          checkSavedFn(() => {
            (window as unknown as { __navCalled?: boolean }).__navCalled = true;
          })
        }
      >
        Home
      </button>
      {sheet.map((row, index) => (
        <div
          key={`row-${index}`}
          data-testid="sheet-row"
          data-section-id={row.sectionId?.id ?? ''}
        />
      ))}
    </div>
  );
}
