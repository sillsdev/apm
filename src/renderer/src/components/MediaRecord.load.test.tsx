// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecord from './MediaRecord';

type WsProps = {
  blob?: Blob;
  loading?: boolean;
  setBlobReady?: (r: boolean) => void;
  onDuration?: (d: number) => void;
};
let ws: WsProps | undefined;

const mediaState = {
  status: 0,
  error: null as null | string,
  url: '',
  id: '',
  remoteId: '',
  cancelled: false,
};

jest.mock('../utils/typeLimit', () => ({ typeLimit: () => 1 }));

jest.mock('./WSAudioPlayer', () => {
  const Mock = (props: WsProps) => {
    ws = props;
    return <div data-testid="ws" />;
  };
  Mock.displayName = 'MockWSAudioPlayer';
  return { __esModule: true, default: Mock, WSAudioPlayerControls: {} };
});

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  MediaSt: { IDLE: 0, PENDING: 1, FETCHED: 2, ERROR: 3 },
  useFetchMediaUrl: () => ({
    // Mutates the shared object so mediaStateRef sees the result synchronously,
    // standing in for the real hook once its fetch has settled.
    fetchMediaUrl: ({ id }: { id: string }) => {
      mediaState.id = id;
      mediaState.url = id ? `http://audio/${id}` : '';
      mediaState.status = id ? 2 : 0;
    },
    mediaState,
  }),
  useMediaUpload: () => () => Promise.resolve(),
  convertToFormat: (b: Blob) => Promise.resolve(b),
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../context/UnsavedContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: R.createContext({
      state: {
        toolsChanged: 0,
        saveRequested: () => false,
        saveCompleted: jest.fn(),
        clearRequested: () => false,
        clearCompleted: jest.fn(),
      },
    }),
  };
});

jest.mock('../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../crud/useStepTool', () => ({
  useStepTool: () => ({ settings: undefined }),
}));

/** url -> resolver, so a load can be held in flight. */
const pending: Record<string, (b: Blob | undefined) => void> = {};
const loadCalls: string[] = [];

jest.mock('../utils', () => {
  const waitForIt =
    jest.requireActual<typeof import('../utils/waitForIt')>(
      '../utils/waitForIt'
    ).waitForIt;
  return {
    infoMsg: jest.fn(),
    logError: jest.fn(),
    Severity: { error: 'error' },
    useMobile: () => ({ isMobile: false }),
    JSONParse: jest.fn(),
    waitForIt,
    loadBlobAsync: (url: string) => {
      loadCalls.push(url);
      return new Promise((resolve) => {
        pending[url] = resolve as (b: Blob | undefined) => void;
      });
    },
  };
});

jest.mock('react-redux', () => ({
  useSelector: (s: { name?: string }) =>
    s.name === 'passageRecordSelector'
      ? { loading: 'Loading', saving: 'Saving' }
      : { NoSaveWoMedia: 'no media', mediaError: 'Media error' },
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  passageRecordSelector: { name: 'passageRecordSelector' },
  sharedSelector: { name: 'sharedSelector' },
}));

const props = {
  toolId: 'phrase-tool',
  artifactId: 'phrasebt',
  passageId: 'p1',
  afterUploadCb: jest.fn(),
  defaultFilename: 'rec',
  setCanSave: jest.fn(),
  setStatusText: jest.fn(),
  width: 400,
};

const url = (id: string) => `http://audio/${id}`;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));

/** Blob handed to each load, by media id, so takes can be told apart. */
const delivered: Record<string, Blob> = {};

/** Delivers a held load and reports ready, as a healthy waveform does. */
const finishLoad = async (id: string) => {
  const blob = new Blob([id], { type: 'audio/ogg' });
  delivered[id] = blob;
  await act(async () => {
    pending[url(id)]?.(blob);
  });
  await act(async () => {
    ws?.setBlobReady?.(true);
    ws?.onDuration?.(5);
    await new Promise((r) => setTimeout(r, 10));
  });
};

describe('MediaRecord existing-take loading', () => {
  beforeEach(() => {
    ws = undefined;
    loadCalls.length = 0;
    Object.keys(pending).forEach((k) => delete pending[k]);
    mediaState.status = 0;
    mediaState.id = '';
    mediaState.url = '';
  });
  afterEach(() => cleanup());

  it('loads the take for each mediaId the parent moves to', async () => {
    const { rerender } = render(<MediaRecord {...props} mediaId="m1" />);
    await waitFor(() => expect(loadCalls).toContain(url('m1')));
    await finishLoad('m1');

    // an un-recorded segment: nothing to show
    rerender(<MediaRecord {...props} mediaId={undefined} />);
    await waitFor(() => expect(ws?.blob).toBeUndefined());

    rerender(<MediaRecord {...props} mediaId="m2" />);
    await waitFor(() => expect(loadCalls).toContain(url('m2')));
  });

  // TT-7609: clause navigation changes mediaId while the previous segment's
  // load (or its save) is still in flight. Skipping the load outright left the
  // take of the segment navigated to invisible until the step was remounted.
  it('still loads the take when mediaId changes mid-load', async () => {
    const { rerender } = render(<MediaRecord {...props} mediaId="m2" />);
    await waitFor(() => expect(loadCalls).toContain(url('m2')));

    // m2's blob has not arrived yet, so the recorder is still loading
    rerender(<MediaRecord {...props} mediaId="m1" />);
    await settle();

    // The abandoned load settles late. Its audio belongs to the segment we
    // left, so it must not be handed to the waveform.
    const staleBlob = new Blob(['m2'], { type: 'audio/ogg' });
    await act(async () => {
      pending[url('m2')]?.(staleBlob);
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(ws?.blob).not.toBe(staleBlob);

    await waitFor(() => expect(loadCalls).toContain(url('m1')));
    await finishLoad('m1');
    expect(ws?.blob).toBe(delivered['m1']);
  });
});
