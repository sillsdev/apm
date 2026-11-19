/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  UploadPendingLeaveProvider,
  useUploadPendingLeave,
  type GuardLeaveArgs,
} from './UploadPendingLeaveContext';

jest.mock('../../api-variable', () => ({ isElectron: false }));
jest.mock('../selector', () => ({ mediaTabSelector: {} }));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    pendingUploadTitle: 'Pending media uploads',
    pendingUploadLeavePrompt: 'Upload before switching?',
    pendingUploadLeaveLogoutPrompt: 'Upload before logout?',
    pendingUploadLeaveAfterSwitchPrompt: 'Upload previous project now?',
    pendingUploadLeaveUpload: 'Upload all',
    pendingUploadLeaveUploadFailed: 'Some could not be uploaded.',
    pendingUploadLeaveContinue: 'Continue without uploading',
    pendingUploadLeaveLossWarn: 'This will permanently remove recordings.',
    pendingUploadRetryLater: 'Try again later.',
    cancel: 'Cancel',
    yes: 'Yes',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../hoc/SnackBar', () => ({
  AlertSeverity: { Error: 'error' },
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));
jest.mock('../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../utils/localUserKey', () => ({
  LocalKey: { uploadPendingProject: 'uploadPendingProject' },
  localUserKey: (id: string) => `u1-${id}`,
}));

const mockGlobals: Record<string, unknown> = {
  project: '',
  connected: true,
  offline: false,
  errorReporter: undefined,
};
jest.mock('./useGlobal', () => ({
  useGlobal: (key: string) => [mockGlobals[key], jest.fn()],
}));

const mockUploadOne = jest.fn();
jest.mock('../crud/useUploadPendingBlobUpload', () => ({
  useUploadPendingBlobUpload: () => mockUploadOne,
}));

const mockPending: Record<string, string[]> = {};
const mockDiscard = jest.fn(async (projectId: string) => {
  const n = mockPending[projectId]?.length ?? 0;
  mockPending[projectId] = [];
  return n;
});
jest.mock('../store/upload/uploadPendingBlobs', () => ({
  isUploadPendingInFlight: () => false,
  listUploadPendingEntries: async (projectId: string) =>
    (mockPending[projectId] ?? []).map((key) => ({ key, projectId })),
  discardUploadPendingForProject: (projectId: string) => mockDiscard(projectId),
}));

const LAST_KEY = 'u1-uploadPendingProject';

let guardLeave: (args: GuardLeaveArgs) => void = () => undefined;
function Consumer() {
  guardLeave = useUploadPendingLeave();
  return null;
}

const renderProvider = () =>
  render(
    <UploadPendingLeaveProvider>
      <Consumer />
    </UploadPendingLeaveProvider>
  );

beforeEach(() => {
  localStorage.clear();
  mockGlobals.project = '';
  mockGlobals.connected = true;
  for (const key of Object.keys(mockPending)) delete mockPending[key];
  mockDiscard.mockClear();
  mockUploadOne.mockReset();
});

describe('UploadPendingLeaveProvider', () => {
  it('lets the user leave at once when nothing is pending', async () => {
    localStorage.setItem(LAST_KEY, 'projA');
    renderProvider();
    const proceed = jest.fn();
    act(() =>
      guardLeave({ enteringProjectId: 'projB', reason: 'switch', proceed })
    );
    await waitFor(() => expect(proceed).toHaveBeenCalled());
    expect(screen.queryByText('Upload before switching?')).toBeNull();
  });

  it('gates a switch from Team home using the last opened project', async () => {
    // Team home has cleared `project`; the last opened one is remembered.
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    renderProvider();
    const proceed = jest.fn();
    act(() =>
      guardLeave({ enteringProjectId: 'projB', reason: 'switch', proceed })
    );

    expect(
      await screen.findByText('Upload before switching?')
    ).toBeInTheDocument();
    expect(proceed).not.toHaveBeenCalled();
  });

  it('stays put on Cancel and keeps Upload Pending', async () => {
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    renderProvider();
    const proceed = jest.fn();
    act(() => guardLeave({ reason: 'logout', proceed }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Upload before logout?')).toBeNull();
    expect(proceed).not.toHaveBeenCalled();
    expect(mockDiscard).not.toHaveBeenCalled();
  });

  it('discards only after the data-loss warning is confirmed', async () => {
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    renderProvider();
    const proceed = jest.fn();
    act(() =>
      guardLeave({ enteringProjectId: 'projB', reason: 'switch', proceed })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Continue without uploading' })
    );
    expect(mockDiscard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(proceed).toHaveBeenCalled());
    expect(mockDiscard).toHaveBeenCalledWith('projA');
  });

  it('leaves once Upload all clears the project', async () => {
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    mockUploadOne.mockImplementation(async () => {
      mockPending.projA = [];
      return true;
    });
    renderProvider();
    const proceed = jest.fn();
    act(() =>
      guardLeave({ enteringProjectId: 'projB', reason: 'switch', proceed })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Upload all' }));

    await waitFor(() => expect(proceed).toHaveBeenCalled());
  });

  it('says so and stays when Upload all leaves recordings behind', async () => {
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    mockUploadOne.mockResolvedValue(false);
    renderProvider();
    const proceed = jest.fn();
    act(() =>
      guardLeave({ enteringProjectId: 'projB', reason: 'switch', proceed })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Upload all' }));

    expect(
      await screen.findByText('Some could not be uploaded.')
    ).toBeInTheDocument();
    expect(proceed).not.toHaveBeenCalled();
  });

  it('prompts about the previous project when one opens around the gate', async () => {
    // A deep link or reload opened projB while projA still has Upload Pending.
    localStorage.setItem(LAST_KEY, 'projA');
    mockPending.projA = ['k1'];
    mockGlobals.project = 'projB';
    renderProvider();

    expect(
      await screen.findByText('Upload previous project now?')
    ).toBeInTheDocument();
    expect(localStorage.getItem(LAST_KEY)).toBe('projB');
  });
});
