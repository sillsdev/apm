import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      errorReporter: {},
      coordinator: { getSource: () => undefined },
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

jest.mock('../../utils', () => ({
  Online: (_force: boolean, cb: (connected: boolean) => void) => cb(true),
}));

jest.mock('../../crud', () => ({
  pullTableList: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../store', () => ({
  nextUpload: jest.fn((props: { cb?: Function }) => {
    void props.cb?.(0, true, { stringId: 'media-1' });
    return { type: 'NEXT_UPLOAD' };
  }),
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

describe('PendingUploadsDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
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
});
