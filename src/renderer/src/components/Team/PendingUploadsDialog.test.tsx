import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NextUploadProps } from '../../store/upload/actions';

/**
 * TT-7363 (reopen, Dharmaraj 2026-09-16 comment 1): after a successful Retry
 * the file stays in the Pending Media Uploads dialog, so the user can retry
 * the same upload over and over (each one creating another cloud mediafile).
 *
 * `nextUpload`'s success path (store/upload/actions.tsx `completeCB`) awaits
 * the caller `cb` *first* and only then calls `removePendingMediaUpload`. The
 * dialog's `cb` refreshes its list from localStorage inside that await, so it
 * reads the row while it is still there — and nothing re-reads afterwards
 * because the dialog never subscribes to pending-list changes (only
 * `TeamActions` does, which is why the Home badge count drops but the dialog
 * list does not).
 */

jest.mock('../../../api-variable', () => ({
  isElectron: true,
  API_CONFIG: { host: 'test-host' },
}));

const mockIpc = {
  exists: jest.fn(async () => true),
  read: jest.fn(async () => new Uint8Array([1, 2, 3])),
};
(window as unknown as { api: unknown }).api = mockIpc;

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useDispatch: () => mockDispatch,
  useSelector: (sel: (state: unknown) => unknown) => sel({}),
}));

jest.mock('../../selector', () => ({
  mediaTabSelector: () => ({
    pendingUploadTitle: 'Pending Media Uploads',
    pendingUploadEmpty: 'No pending uploads',
    pendingUploadRetryOne: 'Retry',
    pendingUploadBatchRetry: 'Retry All',
    pendingUploadDismiss: 'Dismiss',
    pendingUploadRetryLater: 'Retry later',
  }),
  sharedSelector: () => ({ close: 'Close', mustBeOnline: 'Must be online' }),
}));

jest.mock('../../context/TokenProvider', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: ReactActual.createContext({ state: { accessToken: 'tok' } }),
  };
});

const mockMemory = { cache: { query: jest.fn(() => []) }, keyMap: {} };
const mockCoordinator = {
  getSource: jest.fn((name: string) => {
    if (name === 'memory') return mockMemory;
    return {};
  }),
};

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      errorReporter: {},
      coordinator: mockCoordinator,
      connected: true,
      offline: false,
      user: 'user-1',
    };
    return [mockValues[key], jest.fn()];
  }),
  useGetGlobal: jest.fn(() => (key: string) => {
    if (key === 'offline') return false;
    if (key === 'importexportBusy') return false;
    return undefined;
  }),
}));

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
  AlertSeverity: { Warning: 'warning', Error: 'error' },
}));

jest.mock('../../utils', () => ({
  Online: (_force: boolean, cb: (connected: boolean) => void) => cb(true),
}));

jest.mock('../../store/upload/uploadTerminalMessages', () => ({
  formatUploadTerminalFailureMessage: jest.fn(() => 'upload failed'),
}));

const mockCompleteRetry = jest.fn(async () => {});
jest.mock('../../store/upload/completePendingUploadRetry', () => ({
  completePendingUploadRetry: (...args: unknown[]) =>
    mockCompleteRetry(...(args as [])),
}));

/**
 * Mirrors the ordering in `nextUpload`'s `completeCB` success branch: the
 * caller callback is awaited before the pending row is dropped.
 */
const mockNextUpload = jest.fn((props: NextUploadProps) => props);
jest.mock('../../store', () => ({
  nextUpload: (props: NextUploadProps) => mockNextUpload(props),
}));

const mockDispatch = jest.fn((action: unknown) => {
  const props = action as NextUploadProps;
  void (async () => {
    await Promise.resolve(
      props.cb?.(0, true, { stringId: 'media-99' } as never)
    );
    if (props.pendingUploadIdToClearOnSuccess) {
      removePendingMediaUpload(props.pendingUploadIdToClearOnSuccess);
    }
  })();
  return action;
});

import {
  appendPendingMediaUpload,
  loadPendingMediaUploads,
  removePendingMediaUpload,
} from '../../store/upload/pendingMediaUploads';
import { UploadType } from '../UploadType';
const { PendingUploadsDialog } =
  jest.requireActual<typeof import('./PendingUploadsDialog')>(
    './PendingUploadsDialog'
  );

const stagePendingRow = (originalFile: string) =>
  appendPendingMediaUpload({
    localAbsolutePath: `C:/data/${originalFile}`,
    fileSize: 1234,
    uploadType: UploadType.Media,
    record: {
      planId: 'plan-1',
      passageId: 'pas-1',
      originalFile,
      contentType: 'audio/wav',
      versionNumber: 1,
      userId: 'user-1',
    } as never,
    restore: { kind: 'title', sectionId: 'sec-1' },
  });

describe('PendingUploadsDialog Retry (TT-7363)', () => {
  beforeEach(() => {
    localStorage.clear();
    mockDispatch.mockClear();
    mockCompleteRetry.mockClear();
  });

  afterEach(cleanup);

  it('drops the retried row from the list once the upload succeeds', async () => {
    stagePendingRow('speakerinfo.wav');
    render(<PendingUploadsDialog open onClose={jest.fn()} />);

    expect(screen.getByText('speakerinfo.wav')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // The row really is gone from storage...
    await waitFor(() => expect(loadPendingMediaUploads()).toHaveLength(0));
    // ...so the dialog must not keep offering Retry for it.
    await waitFor(() =>
      expect(screen.queryByText('speakerinfo.wav')).not.toBeInTheDocument()
    );
    expect(screen.getByText('No pending uploads')).toBeInTheDocument();
  });

  it('reflects a row removed by another window while the dialog is open', async () => {
    const row = stagePendingRow('audiocomment.wav');
    render(<PendingUploadsDialog open onClose={jest.fn()} />);

    expect(screen.getByText('audiocomment.wav')).toBeInTheDocument();

    removePendingMediaUpload(row.id);

    await waitFor(() =>
      expect(screen.queryByText('audiocomment.wav')).not.toBeInTheDocument()
    );
  });
});
