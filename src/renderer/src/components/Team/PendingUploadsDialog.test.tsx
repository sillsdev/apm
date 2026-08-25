// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadType } from '../UploadType';
import {
  appendPendingMediaUpload,
  type PendingUploadMediaRecord,
} from '../../store/upload/pendingMediaUploads';

const mockShowMessage = jest.fn();
const mockDispatch = jest.fn();

jest.mock('../../../api-variable', () => ({
  isElectron: true,
}));

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useDispatch: () => mockDispatch,
  useSelector: (sel: (s: typeof mockState) => unknown) => sel(mockState),
}));

const mockState = {
  strings: {
    mediaTab: {
      pendingUploadTitle: 'Pending media uploads',
      pendingUploadEmpty: 'No pending uploads.',
      pendingUploadRetryOne: 'Retry',
      pendingUploadBatchRetry: 'Retry all',
      pendingUploadDismiss: 'Remove from list',
      pendingUploadRetryLater: 'Try again later.',
      uploadComplete: '{0} of {1} files uploaded successfully.',
    },
    shared: {
      close: 'Close',
      mustBeOnline: 'Must be online',
    },
  },
};

jest.mock('../../selector', () => ({
  mediaTabSelector: (state: typeof mockState) => state.strings.mediaTab,
  sharedSelector: (state: typeof mockState) => state.strings.shared,
}));

/** Stand-in for memory/remote/backup so the pullTableList branch is reached. */
const mockOrbitSource = {};

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      errorReporter: {},
      coordinator: { getSource: () => mockOrbitSource },
      connected: true,
      offline: false,
    };
    return [mockValues[key], jest.fn()];
  }),
  useGetGlobal: () => (key: string) => {
    if (key === 'offline') return false;
    if (key === 'importexportBusy') return false;
    return undefined;
  },
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('../../hoc/SnackBar', () => ({
  AlertSeverity: { Warning: 'warning' },
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

const mockLogError = jest.fn();

jest.mock('../../utils', () => ({
  Online: (_force: boolean, cb: (connected: boolean) => void) => cb(true),
  Severity: { info: 0, error: 1, retry: 2 },
  logError: (...args: unknown[]) => mockLogError(...args),
}));

const mockPullTableList = jest.fn((..._args: unknown[]) => Promise.resolve());

jest.mock('../../crud', () => ({
  pullTableList: (...args: unknown[]) => mockPullTableList(...args),
}));

/** Deferred upload completions, so a test can step them one at a time. */
const mockUploadCompletions: Array<() => void> = [];
let mockDeferUploads = false;

jest.mock('../../store', () => ({
  nextUpload: jest.fn(
    (props: {
      cb?: (n: number, success: boolean, data?: { stringId: string }) => void;
    }) => {
      const complete = () => void props.cb?.(0, true, { stringId: 'media-1' });
      if (mockDeferUploads) mockUploadCompletions.push(complete);
      else complete();
      return { type: 'NEXT_UPLOAD' };
    }
  ),
}));

import { PendingUploadsDialog } from './PendingUploadsDialog';

const pendingRecord = {
  planId: 'plan-1',
  versionNumber: 1,
  originalFile: 'audio.mp3',
  contentType: 'audio/mpeg',
  artifactTypeId: '',
  passageId: 'passage-1',
  userId: 'user-1',
  recordedbyUserId: 'user-1',
  sourceMediaId: '',
  sourceSegments: '{}',
} as PendingUploadMediaRecord;

/** Run the next deferred upload callback and let React flush the update. */
const completeNextUpload = async () => {
  const complete = mockUploadCompletions.shift();
  expect(complete).toBeDefined();
  await act(async () => {
    complete?.();
  });
};

describe('PendingUploadsDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockUploadCompletions.length = 0;
    mockDeferUploads = false;
    mockPullTableList.mockImplementation(() => Promise.resolve());
    (window as unknown as { api: unknown }).api = {
      exists: jest.fn(async () => true),
      read: jest.fn(async () => new Uint8Array([1, 2, 3])),
    };
  });

  it('hides Retry all when only one pending file is listed (TT-7344)', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/audio.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: pendingRecord,
    });

    render(<PendingUploadsDialog open onClose={jest.fn()} />);

    expect(screen.getByText('Retry')).toBeInTheDocument();
    expect(screen.queryByText('Retry all')).not.toBeInTheDocument();
  });

  it('shows Retry all when more than one pending file is listed (TT-7344)', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/audio.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: pendingRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/other.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: { ...pendingRecord, originalFile: 'other.mp3' },
    });

    render(<PendingUploadsDialog open onClose={jest.fn()} />);

    expect(screen.getByText('Retry all')).toBeInTheDocument();
  });

  it('shows uploadComplete after a successful Retry (TT-7364)', async () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/audio.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: pendingRecord,
    });

    render(<PendingUploadsDialog open onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockShowMessage).toHaveBeenCalledWith(
        '1 of 1 files uploaded successfully.'
      );
    });
  });

  it('shows incremental retry progress while Retry all runs (TT-7364)', async () => {
    mockDeferUploads = true;
    appendPendingMediaUpload({
      localAbsolutePath: '/a/audio.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: pendingRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/other.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: { ...pendingRecord, originalFile: 'other.mp3' },
    });

    render(<PendingUploadsDialog open onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Retry all'));

    // First upload is in flight: determinate bar at 0%, labelled "0 of 2".
    await waitFor(() => expect(mockUploadCompletions).toHaveLength(1));
    const progress = screen.getByTestId('pending-upload-progress');
    const bar = progress.querySelector('.MuiLinearProgress-root');
    expect(bar).toHaveClass('MuiLinearProgress-determinate');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(
      screen.getByText('0 of 2 files uploaded successfully.')
    ).toBeInTheDocument();

    // Complete only the first upload; the second is still pending.
    await completeNextUpload();

    expect(mockShowMessage).toHaveBeenCalledWith(
      '1 of 2 files uploaded successfully.'
    );
    await waitFor(() =>
      expect(screen.getByTestId('pending-upload-progress')).toHaveTextContent(
        '1 of 2 files uploaded successfully.'
      )
    );
    expect(
      screen
        .getByTestId('pending-upload-progress')
        .querySelector('.MuiLinearProgress-root')
    ).toHaveAttribute('aria-valuenow', '50');

    // Complete the second upload; the retry finishes and the bar goes away.
    await waitFor(() => expect(mockUploadCompletions).toHaveLength(1));
    await completeNextUpload();

    expect(mockShowMessage).toHaveBeenCalledWith(
      '2 of 2 files uploaded successfully.'
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('pending-upload-progress')
      ).not.toBeInTheDocument()
    );
  });
  it('finishes the retry queue when pullTableList rejects', async () => {
    mockDeferUploads = true;
    mockPullTableList.mockImplementation(() =>
      Promise.reject(new Error('pull failed'))
    );
    appendPendingMediaUpload({
      localAbsolutePath: '/a/audio.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: pendingRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/other.mp3',
      fileSize: 10,
      uploadType: UploadType.Media,
      record: { ...pendingRecord, originalFile: 'other.mp3' },
    });

    render(<PendingUploadsDialog open onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('Retry all'));

    await waitFor(() => expect(mockUploadCompletions).toHaveLength(1));
    await completeNextUpload();

    // A failed pull is logged, not swallowed, and does not stall progress.
    await waitFor(() => expect(mockLogError).toHaveBeenCalled());
    expect(mockShowMessage).toHaveBeenCalledWith(
      '1 of 2 files uploaded successfully.'
    );

    // The queue still advances to the second file and then clears busy.
    await waitFor(() => expect(mockUploadCompletions).toHaveLength(1));
    await completeNextUpload();

    expect(mockShowMessage).toHaveBeenCalledWith(
      '2 of 2 files uploaded successfully.'
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('pending-upload-progress')
      ).not.toBeInTheDocument()
    );
  });
});
