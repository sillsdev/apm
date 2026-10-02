/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * TT-7365: repeated Save clicks while offline created a separate "Pending
 * Media Uploads" row per click instead of one row for the section recording.
 *
 * Uses the real `pendingMediaUploads` module (localStorage-backed) so the
 * assertion matches what the Pending Media Uploads dialog actually reads,
 * rather than mocking the append/update calls away.
 *
 * `actions.tsx` captures `window.api` into a module-level `ipc` const at
 * import time, so `window.api` must be set *before* `require('./actions')`
 * on each fresh module load (see jest-testing-takeaways.mdc "Module-level
 * window / global capture").
 */
import { UploadType } from '../../components/UploadType';
import { type MediaFileAttributes } from '../../model';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
}));
jest.mock('../../utils/typeLimit', () => ({
  typeLimit: () => 500,
}));
jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));

jest.mock('../../utils', () => ({
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

jest.mock('./uploadRetry', () => {
  const actual = jest.requireActual(
    './uploadRetry'
  ) as typeof import('./uploadRetry');
  return {
    ...actual,
    waitForImportExportIdle: jest.fn(async () => undefined),
    sleepMs: jest.fn(() => Promise.resolve()),
  };
});

const baseRecord = {
  planId: 'plan-1',
  versionNumber: 1,
  originalFile: 'recording.wav',
  contentType: 'audio/wav',
  artifactTypeId: '',
  passageId: 'passage-1',
  userId: 'user-1',
  recordedbyUserId: 'user-1',
  sourceMediaId: '',
  sourceSegments: '{}',
  performedBy: null,
  topic: '',
  eafUrl: '',
  transcription: '',
} as MediaFileAttributes & {
  planId: string;
  artifactTypeId: string;
  passageId: string;
  userId: string;
  recordedbyUserId: string;
  sourceMediaId: string;
};

const makeFile = () =>
  new File([new Uint8Array([1, 2, 3])], 'recording.wav', {
    type: 'audio/wav',
  });

describe('nextUpload duplicate pending row on repeated offline Save (TT-7365)', () => {
  let dispatch: jest.Mock;
  let writtenPaths: Set<string>;
  let mockIpc: {
    exists: jest.Mock;
    copyFile: jest.Mock;
    write: jest.Mock;
    read: jest.Mock;
  };
  let actionsModule: typeof import('./actions');
  let pendingModule: typeof import('./pendingMediaUploads');

  // File.arrayBuffer() (used by writeFileLocal's non-ipc.copyFile branch)
  // resolves via a macrotask in jsdom, so a pure microtask (`Promise.resolve()`)
  // flush loop never lets it settle. Use real setTimeout ticks instead.
  const flushPromises = async (times = 20) => {
    for (let i = 0; i < times; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    dispatch = jest.fn();

    // Each Save click stages the same in-memory blob again. Simulate the real
    // disk by remembering which paths writeFileLocal has already written to,
    // the same way the previous take's file still exists on the next click
    // (writeFileLocal bumps to a new .verNN filename rather than overwrite).
    writtenPaths = new Set<string>();
    mockIpc = {
      exists: jest.fn(async (p: string) => writtenPaths.has(p)),
      copyFile: jest.fn(async (_from: string, to: string) => {
        writtenPaths.add(to);
      }),
      write: jest.fn(async (p: string) => {
        writtenPaths.add(p);
      }),
      read: jest.fn(async () => new Uint8Array([1, 2, 3])),
    };
    (window as unknown as { api: typeof mockIpc }).api = mockIpc;

    actionsModule = require('./actions');
    pendingModule = require('./pendingMediaUploads');

    // Re-require axios *after* resetModules so we configure the same mock
    // instance `actions.tsx` will import (resetModules gives each module a
    // fresh automock instance; the module-level `import Axios from 'axios'`
    // used elsewhere would otherwise configure a stale, disconnected instance).
    // Offline: every POST attempt fails, exhausting retries into terminal failure.
    const Axios = require('axios').default ?? require('axios');
    (Axios.post as jest.Mock).mockRejectedValue({
      message: 'network error',
    } as never);
  });

  afterEach(() => {
    delete (window as unknown as { api?: typeof mockIpc }).api;
  });

  const clickSave = async () => {
    const action = actionsModule.nextUpload({
      record: baseRecord,
      files: [makeFile()],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();
  };

  it('keeps a single pending row for the section after three failed Save clicks', async () => {
    await clickSave();
    await clickSave();
    await clickSave();

    const pending = pendingModule.loadPendingMediaUploads();
    expect(pending).toHaveLength(1);
    expect(pending[0].record.passageId).toBe('passage-1');
  });
});
