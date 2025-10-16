// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedProvider } from '../../context/UnsavedContext';
import { AlertSeverity } from '../../hoc/SnackBar';
import { RoleNames } from '../../model/roleNames';
import Coordinator from '@orbit/coordinator';

// Mock the useGlobal hook
jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
  useGetGlobal: jest.fn(),
}));
import PassageDetailMarkVerses, {
  MarkVersesProps,
} from './PassageDetailMarkVerses';
import { useGlobal, useGetGlobal } from '../../context/useGlobal';
import {
  PassageD,
  OrgWorkflowStepD,
  MediaFileD,
  SectionResourceD,
} from '../../model';
import { memory } from '../../schema';
import { DetailPlayerProps } from './PassageDetailPlayer';
import { act } from 'react';
// import { IRow } from '../../context/PassageDetailContext';
// import { HotKeyProvider } from '../../context/HotKeyContext';

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
  editAction: JSX.Element | null;
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
let mockPlayerAction: ((segment: string, init: boolean) => void) | undefined;
const mockRowData: IRow[] = [];

const passageAttributes = {
  sequencenum: 1,
  book: 'LUK',
  reference: '1:1-4',
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

jest.mock('../../context/usePassageDetailContext', () => () => ({
  mediafileId: mockMediafileId,
  passage: mockPassage,
  currentstep: mockCurrentStep,
  currentSegment: '',
  setCurrentStep: mockSetCurrentStep,
  orgWorkflowSteps: [mockOrgWorkflowStep],
  setupLocate: jest.fn(),
  rowData: mockRowData,
}));
jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: jest.fn(() => true),
  }),
}));
jest.mock('./PassageDetailPlayer', () => {
  const MockedPassageDetailPlayer = ({ onSegment }: DetailPlayerProps) => {
    mockPlayerAction = onSegment;
    return <div>PassageDetailPlayer</div>;
  };
  MockedPassageDetailPlayer.displayName = 'PassageDetailPlayer';
  return MockedPassageDetailPlayer;
});
// jest.mock('../../crud/useMediaRecorder', () => ({
//   useMediaRecorder: () => ({
//     allowRecord: false,
//     onRecordStart: jest.fn(),
//     onRecordStop: jest.fn(),
//   }),
// }));
jest.mock('../../utils/logErrorService', () => jest.fn());
jest.mock('../../context/GlobalContext', () => ({
  useGlobal: (arg: string) =>
    arg === 'memory' ? [mockMemory, jest.fn()] : [{}, jest.fn()],
  useGetGlobal: () => () => false, // remoteBusy & importexportBusy
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    availableOnClipboard: 'Available on Clipboard',
    cancel: 'Cancel',
    canceling: 'Canceling',
    cantCopy: "Can't Copy",
    clipboard: 'Clipboard',
    clipboardCopy: 'Copy to Clipboard',
    markVerses: 'Mark Verses',
    noData: 'No Data {0}',
    pasteFormat: 'Paste Format',
    reference: 'Reference',
    saveVerseMarkup: 'Save Verse Markup',
    startStop: 'Start --> Stop',
    badReferences: 'ERROR: Markup contains bad references',
    btNotUpdated:
      'WARNING: Since back translation recordings already exist, back translation segments will not be updated to line up with verse changes.',
    issues: 'The verse markup has issues. Do you want to continue?',
    missingReferences: 'Warning: Verses in passage not included: ({0})',
    noReferences: 'Warning: Some audio segments will not be included in verses',
    noSegments: 'ERROR: Some verses have no segment: ({0})',
    outsideReferences: 'ERROR: Some verses are outside passage: ({0})',
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

// Set up the mock to return the global state
(useGlobal as jest.Mock).mockImplementation((key: string) => {
  if (key === 'memory') return [mockMemory, jest.fn()];
  if (key === 'lang') return ['en', jest.fn()];
  if (key === 'user') return ['test-user', jest.fn()];
  if (key === 'organization') return ['test-org', jest.fn()];
  if (key === 'snackMessage') return [<></>, jest.fn()];
  if (key === 'snackAlert') return [undefined, jest.fn()];
  return [undefined, jest.fn()];
});

(useGetGlobal as jest.Mock).mockImplementation((key: string) => {
  return mockGlobalState[key as keyof typeof mockGlobalState];
});

const runTest = (props: MarkVersesProps) =>
  render(
    <UnsavedProvider>
      <PassageDetailMarkVerses {...props} />
    </UnsavedProvider>
  );

afterEach(() => {
  mockPassage.attributes = { ...passageAttributes } as any;
  cleanup();
  jest.clearAllMocks();
});

test('should render a table of verses', async () => {
  // Arrange

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  // Assert
  expect(tbody.children.length).toBe(5); // 4 verses + 1 header row
  expect(tbody.children[0].children.length).toBe(2); // 2 columns
});

test('should mark cell selected when clicking', async () => {
  // Arrange
  const user = userEvent.setup();

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  // Assert
  const firstLimit = tbody.children[1].firstChild as HTMLTableCellElement;
  expect(firstLimit.getAttribute('class')?.includes('selected')).toBeFalsy();

  await user.click(firstLimit);
  expect(firstLimit.getAttribute('class')?.includes('selected')).toBeTruthy();
});

test('should prevent changes', async () => {
  // Arrange
  const user = userEvent.setup();

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const headerLimit = tbody.children[0].firstChild as HTMLTableCellElement;
  const firstLimit = tbody.children[1].firstChild as HTMLTableCellElement;

  await user.dblClick(firstLimit);
  await user?.type(firstLimit?.firstChild as HTMLInputElement, 'Luke 1:2');
  await user.click(headerLimit);

  // Assert
  expect(firstLimit.textContent).toBe('');
});

test('should handle start verse with a letter in one chapter', async () => {
  // Arrange
  mockPassage.attributes = { ...passageAttributes, reference: '1:1b-4' } as any;

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const firstReference = tbody.children[1].children[1] as HTMLTableCellElement;

  // Assert
  expect(firstReference.textContent).toBe('1:1b');
});

test('should handle end verse with a letter in one chapter', async () => {
  // Arrange
  mockPassage.attributes = { ...passageAttributes, reference: '1:1-2a' } as any;

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const secondReference = tbody.children[2].children[1] as HTMLTableCellElement;

  // Assert
  expect(secondReference.textContent).toBe('1:2a');
});

test('should handle cross chapter reference', async () => {
  // Arrange
  mockPassage.attributes = {
    ...passageAttributes,
    reference: '1:80-2:2a',
  } as any;

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const firstReference = tbody.children[1].children[1] as HTMLTableCellElement;

  // Assert
  // table loads without first chapter final verse
  // then reloads once the final verse map is loaded.
  await waitFor(() => expect(firstReference.textContent).toBe('1:80'));
  expect(tbody.children[2].children[1].textContent).toBe('2:1');
  expect(tbody.children[3].children[1].textContent).toBe('2:2a');
});

test('should add limits to the table', async () => {
  // Arrange

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const firstLimit = tbody.children[1].firstChild as HTMLTableCellElement;
  act(() => {
    if (mockPlayerAction) {
      mockPlayerAction(
        '{"regions":"[{\\"start\\":0,\\"end\\":5},{\\"start\\":5,\\"end\\":9},{\\"start\\":12,\\"end\\":17},{\\"start\\":17,\\"end\\":24},{\\"start\\":24,\\"end\\":28},{\\"start\\":9,\\"end\\":12}]"}',
        true
      );
    }
  });

  // Assert
  expect(tbody.children.length).toBe(7); // 6 limits (4 with verss) + 1 header
  expect(firstLimit.textContent).toBe('0.0-5.0');
  expect(tbody.children[2].children[0].textContent).toBe('5.0-9.0');
  expect(tbody.children[3].children[0].textContent).toBe('9.0-12.0');
  expect(tbody.children[4].children[0].textContent).toBe('12.0-17.0');
  // added extra rows
  expect(tbody.children[5].children[0].textContent).toBe('17.0-24.0');
  expect(tbody.children[5].children[1].textContent).toBe('');
  expect(tbody.children[6].children[0].textContent).toBe('24.0-28.0');
  expect(tbody.children[6].children[1].textContent).toBe('');
});
//I'm not sure what this is testing in real life -- how will this happen?
/*
test('should add limits with label to the table', async () => {
  // Arrange

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  const firstLimit = tbody.children[1].firstChild as HTMLTableCellElement;
  act(() => {
    if (mockPlayerAction) {
      mockPlayerAction(
        '{"regions":"[{\\"start\\":0,\\"end\\":5,\\"label\\":\\"1:1-2\\"},{\\"start\\":5,\\"end\\":9},{\\"start\\":12,\\"end\\":17},{\\"start\\":17,\\"end\\":24},{\\"start\\":24,\\"end\\":28},{\\"start\\":9,\\"end\\":12}]"}',
        true
      );
    }
  });

  // Assert
  expect(firstLimit.textContent).toBe('0.0-5.0');
  expect(tbody.children[1].children[1].textContent).toBe('1:1-2');
});
*/
test('should not add refs included already in bridges or labels', async () => {
  // Arrange

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  act(() => {
    if (mockPlayerAction) {
      mockPlayerAction(
        '{"regions":"[{\\"start\\":0,\\"end\\":5,\\"label\\":\\"1:1-2\\"},{\\"start\\":5,\\"end\\":9,\\"label\\":\\"1:3\\"},{\\"start\\":12,\\"end\\":17,\\"label\\":\\"1:4\\"},{\\"start\\":17,\\"end\\":24},{\\"start\\":24,\\"end\\":28},{\\"start\\":9,\\"end\\":12}]"}',
        true
      );
    }
  });

  // Assert
  expect(tbody.children[5].children[1].textContent).toBe('');
});
/* TODO: Fix this test or the code
test('should not add rows including refs already in table', async () => {
  // Arrange

  // Act
  runTest({ width: 1000 });
  const tbody = screen.getByTestId('verse-sheet')?.firstChild?.firstChild
    ?.firstChild as HTMLElement;
  await waitFor(() => expect(tbody.children.length).toBeTruthy()); // table loaded

  act(() => {
    if (mockPlayerAction) {
      mockPlayerAction(
        '{"regions":"[{\\"start\\":0,\\"end\\":5,\\"label\\":\\"1:1-2\\"},{\\"start\\":5,\\"end\\":9,\\"label\\":\\"1:3\\"},{\\"start\\":12,\\"end\\":17,\\"label\\":\\"1:4\\"}]"}',
        true
      );
    }
  });

  // Assert
  expect(tbody.children.length).toBe(4); // 3 limits (with 3 verse refs) + 1 header
});
*/
