import React from 'react';
import '@testing-library/jest-dom';
import { act } from 'react';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import Coordinator from '@orbit/coordinator';
import { UnsavedProvider } from '../../../../context/UnsavedContext';
import { HotKeyProvider } from '../../../../context/HotKeyContext';
import { useGetGlobal, useGlobal } from '../../../../context/useGlobal';
import { AlertSeverity } from '../../../../hoc/SnackBar';
import {
  MediaFileD,
  OrgWorkflowStepD,
  PassageD,
  SectionResourceD,
} from '../../../../model';
import { RoleNames } from '../../../../model/roleNames';
import { memory } from '../../../../schema';
import PassageDetailMarkVerses, {
  MarkVersesProps,
} from './PassageDetailMarkVerses';
import { DetailPlayerProps } from '../../PassageDetailPlayer';

jest.mock('../../../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
  useGetGlobal: jest.fn(),
}));

interface IRow {
  id: string;
  sequenceNum: number;
  version: number;
  mediafile: MediaFileD;
  playItem: string;
  artifactName: string;
  artifactType: string;
  artifactCategory: string;
  done: boolean;
  editAction: React.JSX.Element | null;
  resource: SectionResourceD | null;
  passageId: string;
  isVernacular: boolean;
  isResource: boolean;
  isComment: boolean;
  isKeyTerm: boolean;
  isText: boolean;
  sourceVersion: number;
}

const mockMemory = memory;
const mockMediafileId = 'm1';
const mockPassageId = 'p1';
const mockCurrentStep = 'step1';
const mockSetCurrentStep = jest.fn();
const mockSetCurrentSegment = jest.fn();
let mockPlayerAction: ((segment: string, init: boolean) => void) | undefined;
let mockClearSegments: (() => void | Promise<void>) | undefined;
const mockRowData: IRow[] = [];

const passageAttributes = {
  sequencenum: 1,
  book: 'LUK',
  reference: '1:1-4',
  // Parsed range fields that `parseRef` populates in the real app. Several
  // helpers (isMarkVersesReferenceInPassage, shouldAutoRenumberAfterEdit) read
  // these directly, so without them every row is flagged OutOfRange — the table
  // stops renumbering and the Edit dialog opens the start verse as an editable
  // dropdown instead of read-only text.
  startChapter: 1,
  startVerse: 1,
  endChapter: 1,
  endVerse: 4,
  title: '',
  state: 'noMedia',
  dateCreated: '2024-05-08T15:37:36.284Z',
  dateUpdated: '2024-05-08T15:37:36.284Z',
};

const mockPassage = {
  id: mockPassageId,
  type: 'passage',
  attributes: { ...passageAttributes },
  relationships: {
    lastModifiedByUser: {
      data: { type: 'user', id: 'u1' },
    },
  },
} as PassageD;

const mockOrgWorkflowStep = {
  id: 'step1',
  type: 'orgworkflowstep',
  attributes: {
    process: 'obt',
    name: 'markVerse',
    sequencenum: 1,
    tool: '{}',
    permissions: '{}',
    dateCreated: '2024-05-08T15:37:36.284Z',
    dateUpdated: '2024-05-08T15:37:36.284Z',
  },
  relationships: {
    lastModifiedByUser: {
      data: { type: 'user', id: 'u1' },
    },
  },
} as OrgWorkflowStepD;

jest.mock('../../../../context/usePassageDetailContext', () => () => ({
  mediafileId: mockMediafileId,
  passage: mockPassage,
  currentstep: mockCurrentStep,
  currentSegment: '',
  currentSegmentIndex: -1,
  setCurrentSegment: mockSetCurrentSegment,
  setCurrentStep: mockSetCurrentStep,
  orgWorkflowSteps: [mockOrgWorkflowStep],
  setupLocate: jest.fn(),
  rowData: mockRowData,
  section: '',
  gotoNextStep: jest.fn(),
  setStepComplete: jest.fn(),
}));

jest.mock('../../../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: jest.fn(() => true),
  }),
}));

const mockGotoTime = jest.fn().mockResolvedValue(undefined);

jest.mock('../../PassageDetailPlayer', () => {
  const MockedPassageDetailPlayer = ({
    onSegment,
    onClearSegments,
    controlsRef,
    hasSegmentUndo,
    onSegmentUndo,
  }: DetailPlayerProps) => {
    mockPlayerAction = onSegment;
    mockClearSegments = onClearSegments;
    if (controlsRef) {
      controlsRef.current = {
        gotoTime: mockGotoTime,
        isReady: () => true,
        getProgress: () => 0,
        isPlaying: () => false,
      } as any;
    }
    // Mirror the real player, which renders a segment-undo IconButton
    // (aria-label = undoTip = 'Undo') whenever hasSegmentUndo is set.
    return (
      <div>
        PassageDetailPlayer
        {hasSegmentUndo && (
          <button
            type="button"
            aria-label="Undo"
            onClick={() => onSegmentUndo?.()}
          >
            Undo
          </button>
        )}
      </div>
    );
  };
  MockedPassageDetailPlayer.displayName = 'PassageDetailPlayer';
  return MockedPassageDetailPlayer;
});

jest.mock('../../../../utils/logErrorService', () => jest.fn());
jest.mock('../../../../context/GlobalContext', () => ({
  useGlobal: (arg: string) =>
    arg === 'memory' ? [mockMemory, jest.fn()] : [{}, jest.fn()],
  useGetGlobal: () => () => false,
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    availableOnClipboard: 'Available on Clipboard',
    cancel: 'Cancel',
    canceling: 'Canceling',
    cantCopy: "Can't Copy",
    clipboard: 'Clipboard',
    clipboardCopy: 'Copy to Clipboard',
    doneEditingReference: 'Done Editing',
    edit: 'Edit',
    editReference: 'Edit Reference',
    markVerses: 'Mark Verses',
    noData: 'No Data {0}',
    pasteFormat: 'Paste Format',
    reference: 'Reference',
    reset: 'Reset',
    saveVerseMarkup: 'Save Verse Markup',
    splitVerse: 'Split Verse',
    startStop: 'Start-Stop',
    badReferences: 'ERROR: Markup contains bad references',
    btNotUpdated:
      'WARNING: Since back translation recordings already exist, back translation segments will not be updated to line up with verse changes.',
    issues: 'The verse markup has issues. Do you want to continue?',
    missingReferences: 'Warning: Verses in passage not included: ({0})',
    noReferences: 'Warning: Some audio segments will not be included in verses',
    noSegments: 'ERROR: Some verses have no segment: ({0})',
    outsideReferences: 'ERROR: Some verses are outside passage: ({0})',
    save: 'Save',
    splitSegment: 'Split segment ({0})',
    removeSegment: 'Remove segment ({0})',
    undoTip: 'Undo',
  }),
  shallowEqual: jest.fn(),
}));

const mockCoordinator = new Coordinator();
const mockErrorReporter = {
  notify: jest.fn(),
  _notify: jest.fn(),
  leaveBreadcrumb: jest.fn(),
  addOnError: jest.fn(),
  removeOnError: jest.fn(),
  addOnSession: jest.fn(),
  removeOnSession: jest.fn(),
  startSession: jest.fn(),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  stopSession: jest.fn(),
  getContext: jest.fn(),
  setContext: jest.fn(),
  addContext: jest.fn(),
  clearContext: jest.fn(),
  setUser: jest.fn(),
  clearUser: jest.fn(),
  addMetadata: jest.fn(),
  clearMetadata: jest.fn(),
  addFeatureFlag: jest.fn(),
  clearFeatureFlag: jest.fn(),
  addFeatureFlags: jest.fn(),
  clearFeatureFlags: jest.fn(),
  getSession: jest.fn(),
  _logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as any;

const mockGlobalState = {
  coordinator: mockCoordinator,
  errorReporter: mockErrorReporter,
  fingerprint: 'test-fingerprint',
  memory: mockMemory,
  lang: 'en',
  latestVersion: '1.0.0',
  loadComplete: true,
  offlineOnly: false,
  organization: 'test-org',
  releaseDate: '2024-01-01',
  user: 'test-user',
  alertOpen: false,
  autoOpenAddMedia: false,
  changed: false,
  connected: true,
  dataChangeCount: 0,
  developer: null,
  enableOffsite: false,
  home: false,
  importexportBusy: false,
  orbitRetries: 0,
  orgRole: undefined as RoleNames | undefined,
  plan: '',
  progress: 0,
  project: '',
  projectsLoaded: [],
  projType: '',
  remoteBusy: false,
  saveResult: undefined as string | undefined,
  snackAlert: undefined as AlertSeverity | undefined,
  snackMessage: <></>,
  offline: false,
};

(useGlobal as jest.Mock).mockImplementation((key: string) => {
  if (key === 'memory') return [mockMemory, jest.fn()];
  if (key === 'lang') return ['en', jest.fn()];
  if (key === 'user') return ['test-user', jest.fn()];
  if (key === 'organization') return ['test-org', jest.fn()];
  if (key === 'snackMessage') return [<></>, jest.fn()];
  if (key === 'snackAlert') return [undefined, jest.fn()];
  if (key === 'plan') return ['', jest.fn()];
  if (key === 'progress') return [0, jest.fn()];
  return [undefined, jest.fn()];
});

(useGetGlobal as jest.Mock).mockImplementation(
  (key: string) => mockGlobalState[key as keyof typeof mockGlobalState]
);

const runTest = (props: MarkVersesProps) =>
  render(
    <UnsavedProvider>
      <HotKeyProvider>
        <PassageDetailMarkVerses {...props} />
      </HotKeyProvider>
    </UnsavedProvider>
  );

const verseReference = (index: number) =>
  screen.getByLabelText(`verse-reference-${index}`);

/** Wait for passage-derived verse rows (same gate as emitting mock waveform segments). */
const waitForPassageRowsReady = () =>
  waitFor(() => {
    expect(verseReference(1)).toHaveTextContent('1:1');
  });

const confirmReset = async (user: UserEvent) => {
  // The Reset button now lives in the (mocked) waveform toolbar and drives the
  // player's onClearSegments callback, which opens the confirm dialog.
  await act(async () => {
    await mockClearSegments?.();
  });
  await user.click(document.getElementById('alertYes')!);
};

const editReferenceDialog = () => screen.getByRole('dialog');

/**
 * Click the in-row "Edit Reference" button. It now renders as a compact icon
 * button inside the current table row (visible text "Edit"), so its accessible
 * name comes from its `aria-label` (`verse-edit-reference-<rowIndex>`).
 * Only the selected row
 * shows the button, so exactly one matches at a time.
 */
const clickEditReference = (user: UserEvent) =>
  user.click(
    screen.getByRole('button', { name: /^verse-edit-reference-\d+$/ })
  );

/** Table body for the mark-verses grid (prefer direct `tbody` over `rowgroup` ordering). */
const markVersesTbody = () => {
  const table = screen.getByRole('table', { name: 'mark verses table' });
  const tbody = table.querySelector('tbody');
  if (!tbody) throw new Error('Mark verses table has no tbody');
  return tbody;
};

/**
 * Timestamp display format for the Mark Verses table. The table renders segment
 * limits as either seconds (`8.4`) or mm:ss, and we're still deciding which — so
 * the format lives in ONE place. To switch, edit `fmtTime` to match
 * PassageDetailMarkVerses.tsx; every limits assertion below follows.
 */
const fmtTime = (seconds: number) => seconds.toFixed(1); // ss.s
// For mm:ss instead, swap the line above for:
// const fmtTime = (seconds: number) =>
//   `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
//     .toString()
//     .padStart(2, '0')}`;
const lim = (start: number, end: number) => `${fmtTime(start)}-${fmtTime(end)}`;

/**
 * Click the tbody row whose Limits column shows `limitsText` (requires verse
 * segments / waveform so the cell is not "-"). Scoped to tbody so the label is
 * unique vs dialog title / other copies.
 */
const clickMarkVersesRowByLimitsText = async (
  user: UserEvent,
  limitsText: string
) => {
  const limitsCell = within(markVersesTbody()).getByText(limitsText);
  const row = limitsCell.closest('tr');
  if (!row) throw new Error(`mark verses row not found for ${limitsText}`);
  await user.click(row);
};

afterEach(() => {
  mockPassage.attributes = { ...passageAttributes } as any;
  cleanup();
  jest.clearAllMocks();
});

test('auto-numbers the last verse row with the passage end subpart (6:1-3a)', async () => {
  // `parseRef` strips the subpart from endVerse (3), but the reference string
  // keeps it, so the generated last row should be 6:3a rather than 6:3.
  mockPassage.attributes = {
    ...passageAttributes,
    reference: '6:1-3a',
    startChapter: 6,
    startVerse: 1,
    endChapter: 6,
    endVerse: 3,
  } as any;

  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('6:1');
  });

  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('6:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('6:3a');
});

test('covers the last verse subparts as a range when the passage ends mid-verse (7:2b-4b)', async () => {
  // Passage 7:2b-4b starts at part b of verse 2 (part a is the previous
  // passage) and ends at part b of verse 4. The first row keeps the start
  // subpart (7:2b), and the last row spans the included subparts (7:4a-b) so
  // part a is not left uncovered.
  mockPassage.attributes = {
    ...passageAttributes,
    reference: '7:2b-4b',
    startChapter: 7,
    startVerse: 2,
    endChapter: 7,
    endVerse: 4,
  } as any;

  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent(
      '7:2b'
    );
  });

  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('7:3');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent(
    '7:4a-b'
  );
});

test('updates timestamp rows when the player emits verse markers', async () => {
  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await waitFor(() => {
    expect(within(markVersesTbody()).getByText(lim(0, 10))).toBeInTheDocument();
  });

  expect(within(markVersesTbody()).getByText(lim(10, 20))).toBeInTheDocument();
  expect(within(markVersesTbody()).getByText(lim(20, 69))).toBeInTheDocument();
  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:3');
});

test('highlights the matching waveform region when a row is edited', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(10, 20));
  await clickMarkVersesRowByLimitsText(user, lim(10, 20));
  await clickEditReference(user);
  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('start verse suffix'),
    'a'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  await waitFor(() => {
    expect(mockSetCurrentSegment).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: 10, end: 20 }),
      2
    );
  });
});

test('verse references are read-only in the table', async () => {
  runTest({ width: 375 });

  await waitForPassageRowsReady();
  expect(verseReference(1).tagName).toBe('P');

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await waitFor(() => {
    expect(within(markVersesTbody()).getByText(lim(0, 10))).toBeInTheDocument();
  });

  expect(verseReference(1).tagName).toBe('P');
  expect(verseReference(2).tagName).toBe('P');
  expect(verseReference(3).tagName).toBe('P');
});

test('seeks the waveform when a timestamp row is clicked', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(10, 20));
  mockGotoTime.mockClear();
  await clickMarkVersesRowByLimitsText(user, lim(10, 20));

  await waitFor(() => {
    expect(mockGotoTime).toHaveBeenCalledWith(10.1, { start: 10, end: 20 });
  });
});

test('seeks the waveform when the reference cell is clicked', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(20, 69));
  mockGotoTime.mockClear();
  await user.click(screen.getByLabelText('verse-reference-3'));

  await waitFor(() => {
    expect(mockGotoTime).toHaveBeenCalledWith(20.1, { start: 20, end: 69 });
  });
});

test('opens and cancels the split verse dialog', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);

  const dialogEl = editReferenceDialog();
  expect(
    within(dialogEl).getByRole('heading', {
      name: `Edit Reference for ${lim(0, 10)}`,
    })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('end verse number')).not.toBeDisabled();
  expect(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  ).not.toBeChecked();
  expect(screen.queryByLabelText('start verse number')).not.toBeInTheDocument();
  expect(screen.getByLabelText('start verse reference')).toHaveTextContent(
    '1:1'
  );
  expect(screen.getAllByRole('option', { name: '4' })).toHaveLength(1);
  expect(screen.queryAllByRole('option', { name: '5' })).toHaveLength(0);
  expect(screen.queryByLabelText('start verse suffix')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('end verse suffix')).not.toBeInTheDocument();

  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Cancel' })
  );
  expect(
    screen.queryByRole('heading', {
      name: `Edit Reference for ${lim(0, 10)}`,
    })
  ).not.toBeInTheDocument();
});

test('disables Save on Edit Reference until the reference changes', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);

  const saveButton = within(editReferenceDialog()).getByRole('button', {
    name: 'Save',
  });
  expect(saveButton).toBeDisabled();

  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '2'
  );
  expect(saveButton).not.toBeDisabled();

  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '1'
  );
  expect(saveButton).toBeDisabled();
});

test('keeps Save disabled when Split Verse is toggled without suffix change', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);

  const saveButton = within(editReferenceDialog()).getByRole('button', {
    name: 'Save',
  });
  expect(saveButton).toBeDisabled();

  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  expect(saveButton).toBeDisabled();

  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  expect(saveButton).toBeDisabled();
});

test('saves a split verse range and shifts following references up', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);
  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  expect(
    within(editReferenceDialog()).getByLabelText('end verse number')
  ).not.toBeDisabled();
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '2'
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('start verse suffix'),
    'a'
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse suffix'),
    'e'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent(
    '1:1a-2e'
  );
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:3');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:4');
});

test('opens split verse unchecked for a numeric range like 1:1-4', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.('{"regions":"[{\\"start\\":0,\\"end\\":69}]"}', false);
  });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  await clickMarkVersesRowByLimitsText(user, lim(0, 69));
  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '4'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1-4');

  await clickEditReference(user);
  expect(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  ).not.toBeChecked();
  expect(screen.queryByLabelText('start verse suffix')).not.toBeInTheDocument();
});

test('adds rows when narrowing a wide reference on a single segment', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.('{"regions":"[{\\"start\\":0,\\"end\\":69}]"}', false);
  });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  });

  await clickMarkVersesRowByLimitsText(user, lim(0, 69));
  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '4'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1-4');

  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '1'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:3');
  expect(screen.getByLabelText('verse-reference-4')).toHaveTextContent('1:4');
});

test('adds rows when the first row range is narrowed after spanning the passage', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":30},{\\"start\\":30,\\"end\\":69}]"}',
      false
    );
  });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-4')).toHaveTextContent('1:4');
  });

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '4'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1-4');

  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '1'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:3');
  expect(screen.getByLabelText('verse-reference-4')).toHaveTextContent('1:4');
});

test('saving an ending verse without split creates a range and shifts following rows', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '2'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1-2');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:3');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:4');
});

test('split uses the selected left and right verses rather than the dialog row', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(20, 69));

  await clickMarkVersesRowByLimitsText(user, lim(20, 69));
  await clickEditReference(user);
  expect(
    within(editReferenceDialog()).getByLabelText('start verse reference')
  ).toHaveTextContent('1:3');
  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '4'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:3-4');
});

test('shows undo after dialog save and restores the previous table', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  // Loaded/pre-existing segmentation emits with init=true (see
  // PassageDetailPlayer.setPlayerSegments). Using init=false here would
  // misrepresent the initial load as a user segment change and push a spurious
  // undo snapshot, leaving undo still available after a single undo below.
  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      true
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(0, 10));
  await clickEditReference(user);
  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse number'),
    '2'
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('start verse suffix'),
    'a'
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('end verse suffix'),
    'e'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );

  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent(
    '1:1a-2e'
  );

  await user.click(screen.getByRole('button', { name: 'Undo' }));

  expect(
    screen.queryByRole('button', { name: 'Undo' })
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('verse-reference-1')).toHaveTextContent('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveTextContent('1:3');
});

test('reset clears markers and restores the original reference table', async () => {
  const user = userEvent.setup();

  runTest({ width: 375 });

  await waitForPassageRowsReady();

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await within(markVersesTbody()).findByText(lim(0, 10));

  await clickMarkVersesRowByLimitsText(user, lim(10, 20));
  await clickEditReference(user);
  await user.click(
    within(editReferenceDialog()).getByRole('checkbox', { name: 'Split Verse' })
  );
  await user.selectOptions(
    within(editReferenceDialog()).getByLabelText('start verse suffix'),
    'b'
  );
  await user.click(
    within(editReferenceDialog()).getByRole('button', { name: 'Save' })
  );
  expect(screen.getByLabelText('verse-reference-2')).toHaveTextContent('1:2b');

  await confirmReset(user);

  await waitFor(() => {
    expect(screen.queryByText(lim(0, 10))).not.toBeInTheDocument();
  });

  expect(verseReference(1)).toHaveTextContent('1:1');
  expect(verseReference(2)).toHaveTextContent('1:2');
  expect(verseReference(3)).toHaveTextContent('1:3');
});
