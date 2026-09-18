/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * TT-7363 (reopen, 2026-09-16): "After clicking Retry, the pending file is not
 * removed from the Pending Files dialog. As a result, the user can click Retry
 * multiple times for the same file."
 *
 * Drives the **real** `nextUpload` thunk from the dialog's Retry button (axios
 * POST and the XHR PUT are stubbed to succeed) and asserts against the real
 * localStorage-backed `pendingMediaUploads` store, so the test sees the same
 * ordering production does: `nextUpload` awaits the success callback — which is
 * what re-reads the list into the dialog — *before* it drops the pending row.
 *
 * `actions.tsx` captures `window.api` into a module-level `ipc` const at import
 * time, so `window.api` must be set before the dialog (and, through it,
 * `actions`) is required — see jest-testing-takeaways.mdc "Module-level window /
 * global capture". RTL is required in the same cycle from
 * `@testing-library/react/pure` so hook and renderer share one React.
 */
import Axios from 'axios';
import { UploadType } from '../UploadType';

jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));

jest.mock('../../../api-variable', () => ({
  isElectron: true,
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
  OrbitNetworkErrorRetries: 5,
}));

jest.mock('../../utils/typeLimit', () => ({
  typeLimit: () => 500,
}));

jest.mock('../../utils', () => ({
  // PendingUploadsDialog
  Online: (_force: boolean, cb: (connected: boolean) => void) => cb(true),
  // actions.tsx / writeFileLocal
  dataPath: jest.fn(
    async (_url: string, _type: unknown, local: { localname: string }) => {
      local.localname = 'C:/mock/media';
    }
  ),
  infoMsg: jest.fn((e: Error) => e.message),
  logError: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  createPathFolder: jest.fn(async () => undefined),
  removeExtension: jest.requireActual('../../utils/removeExtension')
    .removeExtension,
}));

jest.mock('../../store/upload/uploadRetry', () => {
  const actual = jest.requireActual(
    '../../store/upload/uploadRetry'
  ) as typeof import('../../store/upload/uploadRetry');
  return {
    ...actual,
    waitForImportExportIdle: jest.fn(async () => undefined),
    sleepMs: jest.fn(() => Promise.resolve()),
  };
});

// The dialog reaches nextUpload through the store barrel; give it the real
// action creator without pulling the rest of the barrel's module graph.
jest.mock('../../store', () => require('../../store/upload/actions'));

// Secondary Orbit restore has its own coverage (restoreAfterPendingUpload.test
// / pendingUploadRetryGaps.test); here it only has to resolve.
const mockCompletePendingUploadRetry = jest.fn(async () => undefined);
jest.mock('../../store/upload/completePendingUploadRetry', () => ({
  completePendingUploadRetry: (...args: unknown[]) =>
    mockCompletePendingUploadRetry(...(args as [])),
}));

jest.mock('../../selector', () => ({
  mediaTabSelector: { name: 'mediaTabSelector' },
  sharedSelector: { name: 'sharedSelector' },
}));

const strings = {
  pendingUploadTitle: 'Pending Media Uploads',
  pendingUploadEmpty: 'No pending uploads',
  pendingUploadRetryOne: 'Retry',
  pendingUploadDismiss: 'Dismiss',
  pendingUploadBatchRetry: 'Retry All',
  pendingUploadRetryLater: 'Retry later',
  close: 'Close',
  mustBeOnline: 'Must be online',
};

jest.mock('react-redux', () => ({
  useSelector: () => strings,
  shallowEqual: jest.fn(),
  // Thunk-aware dispatch so the real nextUpload action actually runs.
  useDispatch: () => {
    const dispatch = (action: unknown): unknown =>
      typeof action === 'function'
        ? (action as (d: unknown) => unknown)(dispatch)
        : action;
    return dispatch;
  },
}));

const globals: Record<string, unknown> = {
  errorReporter: {},
  coordinator: undefined,
  connected: true,
  offline: false,
  user: 'user-1',
  importexportBusy: false,
};
jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => [globals[key], jest.fn()],
  useGetGlobal: () => (key: string) => globals[key],
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: React.createContext({
      state: { accessToken: 'token' },
    }),
  };
});

const mockShowMessage = jest.fn();
jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: mockShowMessage }),
  AlertSeverity: { Warning: 'warning', Error: 'error', Info: 'info' },
}));

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const vndResponse = {
  data: {
    data: {
      id: '42',
      type: 'mediafiles',
      attributes: {
        'version-number': 1,
        'original-file': 'comment.mp3',
        'content-type': 'audio/mpeg',
        'audio-url': 'https://s3.example.com/comment.mp3',
      },
    },
  },
};

describe('PendingUploadsDialog Retry (TT-7363)', () => {
  let writtenPaths: Set<string>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();

    writtenPaths = new Set<string>(['C:/mock/media/comment.mp3']);
    (window as unknown as { api: unknown }).api = {
      exists: jest.fn(async (p: string) => writtenPaths.has(p)),
      copyFile: jest.fn(async (_from: string, to: string) => {
        writtenPaths.add(to);
      }),
      write: jest.fn(async (p: string) => {
        writtenPaths.add(p);
      }),
      read: jest.fn(async () => new Uint8Array([1, 2, 3])),
    };

    const xhrProto = XMLHttpRequest.prototype;
    jest.spyOn(xhrProto, 'open').mockImplementation(() => undefined);
    jest.spyOn(xhrProto, 'send').mockImplementation(function (
      this: XMLHttpRequest
    ) {
      Object.defineProperty(this, 'status', { value: 200, configurable: true });
      if (this.onload) this.onload(new ProgressEvent('load'));
    });
    jest
      .spyOn(xhrProto, 'setRequestHeader')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as unknown as { api?: unknown }).api;
  });

  it('removes the row from the list after a successful retry', async () => {
    const pending =
      require('../../store/upload/pendingMediaUploads') as typeof import('../../store/upload/pendingMediaUploads');
    pending.appendPendingMediaUpload({
      localAbsolutePath: 'C:/mock/media/comment.mp3',
      fileSize: 3,
      uploadType: UploadType.Media,
      record: {
        planId: 'plan-1',
        versionNumber: 1,
        originalFile: 'comment.mp3',
        contentType: 'audio/mpeg',
        artifactTypeId: 'comment-type',
        passageId: 'passage-1',
        userId: 'user-1',
        recordedbyUserId: 'user-1',
        sourceSegments: '{}',
        performedBy: null,
        topic: '',
        eafUrl: '',
        transcription: '',
      } as never,
      restore: {
        kind: 'comment',
        discussionId: 'discussion-1',
        text: 'an audio comment',
      },
    });

    // Required after resetModules so nextUpload's axios instance is this one.
    const axiosForActions = require('axios').default ?? require('axios');
    (axiosForActions.post as jest.Mock).mockResolvedValue(vndResponse as never);
    mockedAxios.post.mockResolvedValue(vndResponse as never);

    const React = require('react') as typeof import('react');
    const { render, screen, cleanup, act } =
      require('@testing-library/react/pure') as typeof import('@testing-library/react/pure');
    const { PendingUploadsDialog } =
      require('./PendingUploadsDialog') as typeof import('./PendingUploadsDialog');

    render(
      React.createElement(PendingUploadsDialog, {
        open: true,
        onClose: jest.fn(),
      })
    );

    expect(screen.getByText('comment.mp3')).toBeTruthy();

    await act(async () => {
      screen.getByText('Retry').closest('button')?.click();
      for (let i = 0; i < 40; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });

    // The store is the source of truth: the upload succeeded, so the row is gone.
    expect(pending.loadPendingMediaUploads()).toHaveLength(0);
    // ...and the dialog the user is looking at must agree, or Retry can be
    // clicked again and the same recording uploaded a second time.
    expect(screen.queryByText('comment.mp3')).toBeNull();
    expect(screen.getByText('No pending uploads')).toBeTruthy();

    cleanup();
  });
});
