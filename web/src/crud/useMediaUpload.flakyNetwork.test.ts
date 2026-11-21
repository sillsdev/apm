/**
 * TT-6424: a recording saved on the web while the network is down. Runs the
 * real nextUpload under useMediaUpload; only the network (axios POST, S3 PUT)
 * is faked. Two saves fail, then the connection comes back and the third
 * save of the same take succeeds.
 */
import React from 'react';
import Axios from 'axios';
import { act, renderHook } from '@testing-library/react';
import { AlertSeverity } from '../hoc/useSnackBar';

jest.mock('axios');
jest.mock('../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
  OrbitNetworkErrorRetries: 3,
  isElectron: false,
}));
jest.mock('../auth/bugsnagClient', () => ({}));
jest.mock('../utils/typeLimit', () => ({ typeLimit: () => 500 }));

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(() => true),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

const mockShowMessage = jest.fn();
jest.mock('../hoc/SnackBar', () => ({
  AlertSeverity: jest.requireActual('../hoc/useSnackBar').AlertSeverity,
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

jest.mock('../store', () => {
  const actions = jest.requireActual('../store/upload/actions');
  return {
    uploadFiles: () => ({ type: 'UPLOAD_LIST' }),
    uploadComplete: () => ({ type: 'UPLOAD_COMPLETE' }),
    nextUpload: actions.nextUpload,
  };
});

jest.mock('../store/upload/uploadRetry', () => ({
  ...jest.requireActual('../store/upload/uploadRetry'),
  sleepMs: () => Promise.resolve(),
  waitForImportExportIdle: () => Promise.resolve(),
}));

jest.mock('../selector', () => ({
  mediaTabSelector: (s: { mediaTab: unknown }) => s.mediaTab,
  sharedSelector: (s: { shared: unknown }) => s.shared,
}));

jest.mock('../utils', () => ({
  infoMsg: (err: Error) => err,
  logError: jest.fn(),
  Severity: { info: 0, error: 1 },
  dataPath: jest.fn(),
  createPathFolder: jest.fn(),
  PathType: { MEDIA: 'media' },
  removeExtension: (name: string) => ({ name, ext: '' }),
}));

jest.mock('../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1 },
}));

jest.mock('../context/TokenProvider', () => ({
  TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
}));

jest.mock('./convertToWebM', () => ({
  DEFAULT_COMPRESSED_MIME: 'audio/ogg;codecs=opus',
  convertToFormat: (blob: Blob) => Promise.resolve(blob),
}));

jest.mock('./index', () => ({
  pullTableList: jest.fn(() => Promise.resolve()),
  related: jest.fn(),
  remoteIdNum: (_table: string, id: string | undefined) => id ?? '',
  useArtifactType: () => ({ localizedArtifactTypeFromId: () => 'comment' }),
  useOfflnMediafileCreate: () => ({ createMedia: jest.fn() }),
}));

const mockMemory = { cache: { query: () => [] }, keyMap: {} };
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    const map: Record<string, unknown> = {
      errorReporter: {},
      memory: mockMemory,
      coordinator: { getSource: () => ({}) },
      user: 'user-1',
      plan: 'plan-1',
    };
    return [map[key], jest.fn()];
  },
  useGetGlobal: () => (key: string) => (key === 'offline' ? false : undefined),
}));

const mockState = {
  mediaTab: {
    uploadComplete: '{0} of {1} files uploaded successfully.',
    uploadFailed: 'Upload Failed!',
    unsupported: '{0} unsupported',
    fileTooBig: '{0} too big',
    pendingUploadPathLabel: 'Saved at {0}',
    pendingUploadRetryLater: 'Try again later.',
    pendingUploadQueuedHint: 'You can retry from Team → {0}.',
    pendingUploadMenu: 'Pending uploads',
    pendingUploadDeleteFailed: 'Delete failed {0}',
  },
  shared: { mediaAttached: 'Media attached' },
};

const mockedAxios = Axios as jest.Mocked<typeof Axios>;
const PENDING_KEY = 'pendingMediaUploadsV1';

/** What an axios POST rejects with when the request never reaches the server. */
const networkDown = () =>
  Promise.reject(
    Object.assign(new Error('Network Error'), { response: undefined })
  );

const created = {
  data: {
    data: {
      id: '42',
      type: 'mediafiles',
      attributes: {
        'version-number': 1,
        'original-file': 'comment.ogg',
        'content-type': 'audio/ogg',
        'audio-url': 'https://s3.test/comment.ogg',
      },
    },
  },
};

describe('useMediaUpload on a flaky network (TT-6424)', () => {
  let putBodies: Blob[];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    putBodies = [];
    const { useDispatch, useSelector } = jest.requireMock('react-redux');
    const dispatch = (action: unknown): unknown =>
      typeof action === 'function' ? action(dispatch) : action;
    useDispatch.mockReturnValue(dispatch);
    useSelector.mockImplementation((sel: (s: typeof mockState) => unknown) =>
      sel(mockState)
    );

    const xhr = XMLHttpRequest.prototype;
    jest.spyOn(xhr, 'open').mockImplementation(() => undefined);
    jest.spyOn(xhr, 'setRequestHeader').mockImplementation(() => undefined);
    jest.spyOn(xhr, 'send').mockImplementation(function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null
    ) {
      putBodies.push(body as Blob);
      Object.defineProperty(this, 'status', { value: 200 });
      this.onload?.(new ProgressEvent('load'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderUpload = (afterUploadCb: jest.Mock) =>
    renderHook(() =>
      useMediaUploadHook({
        fields: { artifactId: 'comment-type', passageId: 'passage-1' },
        afterUploadCb,
        noBusy: true,
        skipImportExportWait: true,
      })
    );

  // Imported after the mocks above are registered.
  const useMediaUploadHook = (
    ...args: Parameters<typeof import('./useMediaUpload').useMediaUpload>
  ) =>
    (
      jest.requireActual(
        './useMediaUpload'
      ) as typeof import('./useMediaUpload')
    ).useMediaUpload(...args);

  const lastMessage = () => mockShowMessage.mock.calls.at(-1);

  const failedSave = async (
    save: (f: File[]) => Promise<boolean>,
    take: File
  ) => {
    mockShowMessage.mockClear();
    let outcome: unknown;
    await act(async () => {
      outcome = await save([take]).catch((e: unknown) => e);
    });
    expect(outcome).toBeInstanceOf(Error);
    // The user is told the save failed, as an error, and the last word is
    // not a neutral "0 of 1 files uploaded successfully." that replaces it.
    expect(lastMessage()?.[1]).toBe(AlertSeverity.Error);
    expect(String(lastMessage()?.[0])).toMatch(/network error/i);
    // The web keeps nothing on disk: no Pending uploads row and no promise
    // that the user can retry from there, so they know to stay and resave.
    expect(localStorage.getItem(PENDING_KEY) ?? '[]').toBe('[]');
    expect(
      mockShowMessage.mock.calls.some(([m]) => String(m).includes('Team →'))
    ).toBe(false);
  };

  it('reports each failed save, then saves the same take once the network is back', async () => {
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUpload(afterUploadCb);
    const take = new File([new Uint8Array([1, 2, 3, 4])], 'comment.ogg', {
      type: 'audio/ogg;codecs=opus',
    });

    mockedAxios.post.mockImplementation(networkDown);
    await failedSave(result.current, take);
    await failedSave(result.current, take);
    expect(afterUploadCb).toHaveBeenCalledWith('');
    expect(putBodies).toHaveLength(0);

    mockedAxios.post.mockResolvedValue(created as never);
    mockShowMessage.mockClear();
    let saved: unknown;
    await act(async () => {
      saved = await result.current([take]);
    });

    expect(saved).toBe(true);
    expect(afterUploadCb).toHaveBeenLastCalledWith('42');
    expect(putBodies).toHaveLength(1);
    expect(putBodies[0]?.size).toBe(take.size);
    expect(lastMessage()?.[0]).toBe('1 of 1 files uploaded successfully.');
  });
});
