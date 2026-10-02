/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import type { MediaFileD } from '../model';
import { UPLOAD_COMPLETE } from '../store/upload/types';
import { OrbitNetworkErrorRetries } from '../../api-variable';

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(() => true),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

const mockShowMessage = jest.fn();
jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

jest.mock('../store', () => ({
  uploadFiles: jest.fn((files: File[]) => ({
    type: 'UPLOAD_LIST',
    payload: files,
  })),
  nextUpload: jest.fn((props: unknown) => ({
    type: 'NEXT_UPLOAD',
    payload: props,
  })),
  uploadComplete: jest.fn(() => ({ type: 'UPLOAD_COMPLETE' })),
}));

jest.mock('../selector', () => ({
  mediaTabSelector: (state: {
    mediaTab: { uploadComplete: string; uploadFailed: string };
  }) => state.mediaTab,
  sharedSelector: (state: { shared: { mediaAttached: string } }) =>
    state.shared,
}));

jest.mock('../context/TokenProvider', () => ({
  TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
}));

let mockMediaFiles: MediaFileD[] = [];
const mockMemory = {
  cache: {
    query: jest.fn(() => mockMediaFiles),
  },
  keyMap: {},
};

jest.mock('./index', () => {
  const pullTableList = jest.fn(() => Promise.resolve());
  const createMedia = jest.fn().mockResolvedValue({ id: 'created-id' });
  return {
    pullTableList,
    related: jest.requireActual('./related').related,
    /** Avoid real keyMap: pass through local ids for plan/passage/user/media */
    remoteIdNum: jest.fn(
      (_table: string, localId: string | undefined) => localId ?? ''
    ),
    useArtifactType: () => ({
      localizedArtifactTypeFromId: jest.fn(() => 'artifact-label'),
    }),
    useOfflnMediafileCreate: () => ({
      createMedia,
    }),
  };
});

let mockOffline = false;
const mockReporter = {};
const mockRemote = {};
const mockBackup = {};
const mockCoordinator = {
  getSource: jest.fn((name: string) => {
    if (name === 'remote') return mockRemote;
    if (name === 'backup') return mockBackup;
    return {};
  }),
};
const mockSetOrbitRetries = jest.fn();

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const map: Record<string, [unknown, jest.Mock]> = {
      errorReporter: [mockReporter, jest.fn()],
      memory: [mockMemory, jest.fn()],
      coordinator: [mockCoordinator, jest.fn()],
      user: ['user-1', jest.fn()],
      orbitRetries: [0, mockSetOrbitRetries],
    };
    return map[key] ?? [undefined, jest.fn()];
  }),
  useGetGlobal: jest.fn(() => (key: string) => {
    if (key === 'offline') return mockOffline;
    if (key === 'plan') return 'plan-1';
    return undefined;
  }),
}));

const mockState = {
  mediaTab: {
    uploadComplete: '{0} of {1} files uploaded successfully.',
    uploadFailed: 'Upload Failed!',
  },
  shared: {
    mediaAttached: 'Media attached',
  },
};

function makeFile(name = 'rec.webm') {
  return new File([new Uint8Array([1, 2, 3])], name, {
    type: 'audio/webm',
  });
}

function vernacularMedia(
  id: string,
  passageId: string,
  versionNumber: number
): MediaFileD {
  return {
    id,
    type: 'mediafile',
    attributes: { versionNumber } as MediaFileD['attributes'],
    relationships: {
      passage: { data: { id: passageId, type: 'passage' } },
      artifactType: { data: null },
    },
  } as MediaFileD;
}

describe('useMediaUpload', () => {
  let dispatch: jest.Mock;
  let useDispatch: jest.Mock;
  let useSelector: jest.Mock;
  let pullTableList: jest.Mock;
  let createMedia: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOffline = false;
    mockMediaFiles = [];
    ({ useDispatch, useSelector } = require('react-redux'));
    dispatch = jest.fn((action: unknown) => action);
    useDispatch.mockReturnValue(dispatch);
    (useSelector as unknown as jest.Mock).mockImplementation(
      (sel: (s: typeof mockState) => unknown) => sel(mockState)
    );

    const idx = jest.requireMock('./index') as {
      pullTableList: jest.Mock;
      useOfflnMediafileCreate: () => { createMedia: jest.Mock };
    };
    pullTableList = idx.pullTableList;
    createMedia = idx.useOfflnMediafileCreate().createMedia;
    pullTableList.mockImplementation(() => Promise.resolve());
    createMedia.mockResolvedValue({ id: 'created-id' });
  });

  function renderUploadHook(props: {
    artifactId: string | null;
    passageId: string | undefined;
    planId?: string;
    afterUploadCb: jest.Mock;
    beforeUpload?: () => Promise<void>;
    pendingRestore?: () => unknown;
  }) {
    const { renderHook } = require('@testing-library/react');
    const { useMediaUpload } = require('./useMediaUpload');
    return renderHook(() =>
      useMediaUpload({
        artifactId: props.artifactId,
        passageId: props.passageId,
        planId: props.planId,
        afterUploadCb: props.afterUploadCb,
        beforeUpload: props.beforeUpload,
        pendingRestore: props.pendingRestore,
      })
    );
  }

  async function waitForNextUpload() {
    const { nextUpload } = require('../store');
    for (let i = 0; i < 50; i++) {
      if ((nextUpload as jest.Mock).mock.calls.length > 0) return nextUpload;
      await Promise.resolve();
    }
    expect(nextUpload).toHaveBeenCalled();
    return nextUpload;
  }

  async function completeUpload(
    upload: (files: File[]) => Promise<boolean>,
    files: File[],
    ...cbArgs: [number, boolean, unknown?]
  ) {
    const uploadPromise = upload(files);
    const nextUpload = await waitForNextUpload();
    const uploadProps = (nextUpload as jest.Mock).mock.calls.at(-1)![0];
    const cb = uploadProps.cb as (
      n: number,
      success: boolean,
      data?: unknown
    ) => void | Promise<void>;
    await cb(...cbArgs);
    return uploadPromise;
  }

  it('online success: pullTableList, dispatch UPLOAD_COMPLETE, snackbar, afterUploadCb', async () => {
    mockOffline = false;
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    const files = [makeFile()];

    await completeUpload(upload, files, 0, true, { stringId: 'media-1' });

    expect(pullTableList).toHaveBeenCalledWith(
      'mediafile',
      ['media-1'],
      mockMemory,
      mockRemote,
      mockBackup,
      mockReporter
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: UPLOAD_COMPLETE })
    );
    expect(mockShowMessage).toHaveBeenCalledWith(
      '1 of 1 files uploaded successfully.'
    );
    expect(afterUploadCb).toHaveBeenCalledWith('media-1');
  });

  it('failure path: orbit retries, 0 of 1 snackbar, empty media id, no pullTableList', async () => {
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await expect(
      completeUpload(upload, [makeFile()], 0, false, undefined)
    ).rejects.toThrow('Upload Failed!');

    expect(mockSetOrbitRetries).toHaveBeenCalledWith(
      OrbitNetworkErrorRetries - 1
    );
    expect(pullTableList).not.toHaveBeenCalled();
    expect(mockShowMessage).toHaveBeenCalledWith(
      '0 of 1 files uploaded successfully.'
    );
    expect(afterUploadCb).toHaveBeenCalledWith('');
  });

  it('offline success: createMedia, snackbar, afterUploadCb with created id, no pullTableList', async () => {
    mockOffline = true;
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await completeUpload(upload, [makeFile()], 0, true, { blob: true });

    expect(pullTableList).not.toHaveBeenCalled();
    expect(createMedia).toHaveBeenCalledWith(
      { blob: true },
      1,
      expect.any(Number),
      'psg-1',
      null,
      '',
      'user-1'
    );
    expect(mockShowMessage).toHaveBeenCalledWith(
      '1 of 1 files uploaded successfully.'
    );
    expect(afterUploadCb).toHaveBeenCalledWith('created-id');
  });

  it('getLatestVersion: existing vernacular versions yield num = 3 for offline createMedia', async () => {
    mockOffline = true;
    mockMediaFiles = [
      vernacularMedia('m1', 'psg-1', 1),
      vernacularMedia('m2', 'psg-1', 2),
      vernacularMedia('other', 'psg-9', 99),
    ];
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await completeUpload(upload, [makeFile()], 0, true, { offline: true });

    expect(createMedia).toHaveBeenCalledWith(
      expect.any(Object),
      3,
      expect.any(Number),
      'psg-1',
      null,
      '',
      'user-1'
    );
  });

  it('getLatestVersion: no existing files yields num = 1', async () => {
    mockOffline = true;
    mockMediaFiles = [];
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await completeUpload(upload, [makeFile()], 0, true, { offline: true });

    expect(createMedia).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      expect.any(Number),
      'psg-1',
      null,
      '',
      'user-1'
    );
  });

  it('getLatestVersion: artifact Id skips version bump (num = 1)', async () => {
    mockOffline = true;
    mockMediaFiles = [vernacularMedia('m1', 'psg-1', 5)];
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: 'art-1',
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await completeUpload(upload, [makeFile()], 0, true, { offline: true });

    expect(createMedia).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      expect.any(Number),
      'psg-1',
      'art-1',
      '',
      'user-1'
    );
  });

  it('rejects when itemComplete bookkeeping throws', async () => {
    mockOffline = true;
    createMedia.mockRejectedValue(new Error('create failed'));
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await expect(
      completeUpload(upload, [makeFile()], 0, true, { blob: true })
    ).rejects.toThrow('create failed');
    expect(afterUploadCb).not.toHaveBeenCalled();
  });

  it('empty file list resolves false without starting upload', async () => {
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await expect(upload([])).resolves.toBe(false);
    expect(afterUploadCb).not.toHaveBeenCalled();
  });

  it('settles when afterUploadCb throws', async () => {
    const afterUploadCb = jest
      .fn()
      .mockRejectedValue(new Error('parent failed'));
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    await expect(
      completeUpload(upload, [makeFile()], 0, true, { stringId: 'media-1' })
    ).resolves.toBe(true);

    expect(afterUploadCb).toHaveBeenCalledWith('media-1');
  });

  it('dispatches uploadComplete action object, not the action creator function', async () => {
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: null,
      passageId: 'psg-1',
      afterUploadCb,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    const { uploadComplete } = require('../store');
    await completeUpload(upload, [makeFile()], 0, true, {
      stringId: 'media-x',
    });

    const completeCalls = dispatch.mock.calls.filter(
      (c) => c[0]?.type === UPLOAD_COMPLETE
    );
    expect(completeCalls.length).toBeGreaterThanOrEqual(1);
    expect(completeCalls[0][0]).toEqual({ type: UPLOAD_COMPLETE });
    expect(uploadComplete).toHaveBeenCalled();
    expect(typeof completeCalls[0][0]).toBe('object');
  });

  it('uses latest performedBy/topic at upload time even if upload fn was captured earlier (TT-6646)', async () => {
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { renderHook, act } = require('@testing-library/react');
    const { useMediaUpload } = require('./useMediaUpload');
    const { result, rerender } = renderHook(
      (props: { performedBy?: string; topic?: string }) =>
        useMediaUpload({
          artifactId: 'art-1',
          passageId: 'psg-1',
          performedBy: props.performedBy,
          topic: props.topic,
          afterUploadCb,
        }),
      { initialProps: { performedBy: '', topic: '' } }
    );
    const staleUpload = result.current as (files: File[]) => Promise<boolean>;

    act(() => {
      rerender({ performedBy: 'Dharma', topic: 'Community Q1' });
    });

    const uploadPromise = staleUpload([makeFile()]);
    const nextUpload = await waitForNextUpload();
    const uploadProps = (nextUpload as jest.Mock).mock.calls.at(-1)![0];
    expect(uploadProps.record.performedBy).toBe('Dharma');
    expect(uploadProps.record.topic).toBe('Community Q1');

    const cb = uploadProps.cb as (
      n: number,
      success: boolean,
      data?: unknown
    ) => void | Promise<void>;
    await cb(0, true, { stringId: 'media-1' });
    await expect(uploadPromise).resolves.toBe(true);
  });

  /**
   * Recorded resource path (TT-7363 / Copilot r3918081583): SelectArtifactCategory
   * defers creating a newly typed category until commit()/beforeUpload. If
   * pendingRestore is snapshotted first, artifactCategoryId is omitted and Retry
   * restores the resource without its category — even though afterUploadCb would
   * later commit on success. Failure never reaches afterUploadCb's commit.
   */
  it('commits beforeUpload before capturing pendingRestore, even when upload fails', async () => {
    let catId: string | undefined;
    const beforeUpload = jest.fn(async () => {
      catId = 'new-cat-1';
    });
    const pendingRestore = jest.fn(() => ({
      kind: 'sectionresource' as const,
      sectionId: 'sec-1',
      description: 'Resource take',
      sequenceNum: 1,
      orgWorkflowStepId: 'ows-1',
      ...(catId ? { artifactCategoryId: catId } : {}),
    }));
    const afterUploadCb = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUploadHook({
      artifactId: 'res-art',
      passageId: 'psg-1',
      afterUploadCb,
      beforeUpload,
      pendingRestore,
    });
    const upload = result.current as (files: File[]) => Promise<boolean>;

    const uploadPromise = upload([makeFile()]);
    const nextUpload = await waitForNextUpload();
    const uploadProps = (nextUpload as jest.Mock).mock.calls.at(-1)![0];
    expect(beforeUpload).toHaveBeenCalled();
    expect(pendingRestore).toHaveBeenCalled();
    expect(beforeUpload.mock.invocationCallOrder[0]).toBeLessThan(
      pendingRestore.mock.invocationCallOrder[0]
    );
    expect(uploadProps.pendingRestore).toEqual(
      expect.objectContaining({ artifactCategoryId: 'new-cat-1' })
    );

    const cb = uploadProps.cb as (
      n: number,
      success: boolean,
      data?: unknown
    ) => void | Promise<void>;
    await cb(0, false, undefined);
    await expect(uploadPromise).rejects.toThrow('Upload Failed!');
    expect(afterUploadCb).toHaveBeenCalledWith('');
  });
});
