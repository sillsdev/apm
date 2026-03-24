// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Coordinator from '@orbit/coordinator';
import { UnsavedProvider } from '../../../../context/UnsavedContext';
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
import PassageDetailMarkVersesIsMobile, {
  MarkVersesProps,
} from './PassageDetailMarkVersesIsMobile';
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

jest.mock('../../../../context/usePassageDetailContext', () => () => ({
  mediafileId: mockMediafileId,
  passage: mockPassage,
  currentstep: mockCurrentStep,
  currentSegment: '',
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

jest.mock('../../PassageDetailPlayer', () => {
  const MockedPassageDetailPlayer = ({ onSegment }: DetailPlayerProps) => {
    mockPlayerAction = onSegment;
    return <div>PassageDetailPlayer</div>;
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
    markVerses: 'Mark Verses',
    noData: 'No Data {0}',
    pasteFormat: 'Paste Format',
    reference: 'Reference',
    saveVerseMarkup: 'Save Verse Markup',
    startStop: 'Start-Stop',
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
      <PassageDetailMarkVersesIsMobile {...props} />
    </UnsavedProvider>
  );

afterEach(() => {
  mockPassage.attributes = { ...passageAttributes } as any;
  cleanup();
  jest.clearAllMocks();
});

test('updates timestamp rows when the player emits verse markers', async () => {
  runTest({ width: 375 });

  await waitFor(() => {
    expect(screen.getByLabelText('verse-reference-1')).toHaveValue('1:1');
  });

  act(() => {
    mockPlayerAction?.(
      '{"regions":"[{\\"start\\":0,\\"end\\":10},{\\"start\\":10,\\"end\\":20},{\\"start\\":20,\\"end\\":69}]"}',
      false
    );
  });

  await waitFor(() => {
    expect(screen.getByText('0.0-10.0')).toBeInTheDocument();
  });

  expect(screen.getByText('10.0-20.0')).toBeInTheDocument();
  expect(screen.getByText('20.0-69.0')).toBeInTheDocument();
  expect(screen.getByLabelText('verse-reference-1')).toHaveValue('1:1');
  expect(screen.getByLabelText('verse-reference-2')).toHaveValue('1:2');
  expect(screen.getByLabelText('verse-reference-3')).toHaveValue('1:3');
});
