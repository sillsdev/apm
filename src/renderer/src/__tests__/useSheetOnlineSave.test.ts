jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn(), showAlert: jest.fn() }),
}));

jest.mock('../crud/usePassageType', () => ({
  usePassageType: () => ({
    getPassageTypeRec: () => ({ id: 'pt1' }),
    checkIt: jest.fn(),
  }),
}));

const mockForceDataChanges = jest.fn(async () => {});

jest.mock('../utils', () => {
  const waitForItMod = jest.requireActual('../utils/waitForIt');
  const currentDateTimeMod = jest.requireActual('../utils/currentDateTime');
  const generateUUIDMod = jest.requireActual('../utils/generateUUID');
  return {
    waitForIt: waitForItMod.waitForIt,
    currentDateTime: currentDateTimeMod.currentDateTime,
    generateUUID: generateUUIDMod.generateUUID,
    useDataChanges: () => mockForceDataChanges,
  };
});

jest.mock('../crud', () => {
  const remoteIdMod = jest.requireActual('../crud/remoteId');
  const findRecordMod = jest.requireActual('../crud/tryFindRecord');
  return {
    ...remoteIdMod,
    findRecord: findRecordMod.findRecord ?? findRecordMod.default,
    usePublishDestination: () => ({
      setPublishTo: () => '',
      isPublished: () => false,
    }),
  };
});

jest.mock('../crud/useOrganizedBy', () => ({
  useOrganizedBy: () => ({ getOrganizedBy: () => 'Section' }),
}));

jest.mock('../components/Sheet', () => ({
  ...jest.requireActual('../components/Sheet/isSectionPassage'),
  ...jest.requireActual('../components/Sheet/isSectionPassageUpdated'),
}));

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import {
  IScriptureTableStrings,
  ISheet,
  SheetLevel,
} from '../model';
import { useWfPaste } from '../components/Sheet/useSheetPaste';
import { shtNumChanges } from '../components/Sheet/shtNumChanges';
import {
  isSectionRow,
  isPassageRow,
} from '../components/Sheet/isSectionPassage';
import {
  hierarchicalLukePasteRows,
  sheetPasteColNames,
} from './fixtures/hierarchicalLukePaste';
import {
  genesisPasteTrimmed,
  findGenesisBook,
} from './fixtures/genesisPasteTrimmed';
import {
  setupOnlineSave,
  runBatchedOnlineSave,
  existingPopulatedSheet,
  setForceDataChangesDelay,
  getForceDataChangesDelay,
  buildLargeAddingSheet,
} from './helpers/sheetSaveTestHarness';

const t = {
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
} as IScriptureTableStrings;

const findLukeBook = (val: string) => (/LUK/i.test(val) ? 'LUK' : '');

function buildSheetFromPaste(
  rows: string[][],
  findBook: (val: string) => string
): ISheet[] {
  const { result } = renderHook(() =>
    useWfPaste({
      secNumCol: sheetPasteColNames.indexOf('sectionSeq'),
      passNumCol: sheetPasteColNames.indexOf('passageSeq'),
      scripture: true,
      flat: false,
      shared: false,
      colNames: sheetPasteColNames,
      findBook,
      t,
    })
  );
  let pasted: { valid: boolean; addedWorkflow: ISheet[] } | undefined;
  act(() => {
    pasted = result.current(rows);
  });
  if (!pasted?.valid) throw new Error('paste fixture invalid');
  return pasted.addedWorkflow;
}

function firstSectionRow(sheet: ISheet[]) {
  return sheet.find((row) => isSectionRow(row));
}

function firstPassageRow(sheet: ISheet[]) {
  return sheet.find((row) => isPassageRow(row));
}

beforeEach(() => {
  jest.useFakeTimers();
  mockForceDataChanges.mockReset();
  mockForceDataChanges.mockImplementation(async () => {
    const delay = getForceDataChangesDelay();
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  });
  setForceDataChangesDelay(0);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TT-7416 save hang after hierarchical paste', () => {
  it('online save completes after hierarchical paste and assigns ids', async () => {
    const sheet = buildSheetFromPaste(hierarchicalLukePasteRows, findLukeBook);
    expect(shtNumChanges(sheet, undefined)).toBeGreaterThan(10);

    const { onlineSave, setComplete } = setupOnlineSave('brokenKeyMap');
    const savePromise = onlineSave([...sheet]);

    await jest.runAllTimersAsync();

    await expect(savePromise).resolves.toBe(true);
    expect(setComplete).toHaveBeenCalledWith(20);
    expect(setComplete).toHaveBeenCalledWith(50);
    expect(firstSectionRow(sheet)?.sectionId?.id).toBeTruthy();
    expect(firstPassageRow(sheet)?.passage?.id).toBeTruthy();
  }, 15000);

  it('happyPath harness assigns sectionId and passage after save', async () => {
    const sheet = buildSheetFromPaste(hierarchicalLukePasteRows, findLukeBook);
    const { onlineSave, setComplete } = setupOnlineSave('happyPath');

    const result = await onlineSave([...sheet]);

    expect(result).toBe(true);
    expect(setComplete).toHaveBeenCalledWith(20);
    expect(setComplete).toHaveBeenCalledWith(50);
    expect(firstSectionRow(sheet)?.sectionId?.id).toBeTruthy();
    expect(firstPassageRow(sheet)?.passage?.id).toBeTruthy();
    expect(mockForceDataChanges).toHaveBeenCalled();
  });
});

describe('TT-6918 delete-all + genesis paste save', () => {
  it('completes delete sync and assigns ids on new rows', async () => {
    const existing = existingPopulatedSheet().map((row) => ({
      ...row,
      deleted: true,
    }));
    const pasted = buildSheetFromPaste(genesisPasteTrimmed, findGenesisBook);
    const sheet = [...existing, ...pasted];

    const { onlineSave, setComplete, memory } = setupOnlineSave('happyPath');
    await onlineSave([...sheet]);

    expect(setComplete).toHaveBeenCalledWith(50);
    expect((memory.sync as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const newSection = pasted.find((row) => isSectionRow(row));
    expect(newSection?.sectionId?.id).toBeTruthy();
  });

  it('deleteSyncFails rejects during removeRecord sync', async () => {
    const existing = existingPopulatedSheet().map((row) => ({
      ...row,
      deleted: true,
    }));
    const pasted = buildSheetFromPaste(genesisPasteTrimmed, findGenesisBook);
    const sheet = [...existing, ...pasted];

    const { onlineSave } = setupOnlineSave('deleteSyncFails');
    await expect(onlineSave([...sheet])).rejects.toThrow(
      'removeRecord sync failed'
    );
  });
});

describe('TT-7416 batch boundary (optional)', () => {
  it('saving 250+ pasted rows runs multiple batches and assigns ids', async () => {
    const sheet = buildLargeAddingSheet(260);
    expect(sheet.length).toBeGreaterThanOrEqual(250);
    expect(shtNumChanges(sheet, undefined)).toBeGreaterThan(200);

    const { onlineSave, setComplete, memory } = setupOnlineSave('brokenKeyMap');
    const savePromise = runBatchedOnlineSave(sheet, onlineSave, false);
    await jest.runAllTimersAsync();
    await expect(savePromise).resolves.toBeGreaterThanOrEqual(2);

    expect((memory.update as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(
      2
    );
    expect(setComplete).toHaveBeenCalledWith(50);
    sheet
      .filter((row) => isSectionRow(row) && row.level === SheetLevel.Section)
      .forEach((row) => {
        expect(row.sectionId?.id).toBeTruthy();
      });
  }, 15000);
});
