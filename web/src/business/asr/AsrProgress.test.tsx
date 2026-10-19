import React from 'react';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { act, cleanup, render } from '@testing-library/react';
import type { MediaFileD } from '../../model';

// Orbit mutates records in place; only a useOrbitData subscription re-renders.
let orbitMedia: MediaFileD[] = [];
const mockOrbitListeners = new Set<(records: MediaFileD[]) => void>();
const notifyOrbit = () => {
  orbitMedia = [...orbitMedia];
  mockOrbitListeners.forEach((listener) => listener(orbitMedia));
};

jest.mock('../../hoc/useOrbitData', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useOrbitData: (model: string) => {
      const [records, setRecords] = React.useState(() =>
        model === 'mediafile' ? orbitMedia : []
      );
      React.useEffect(() => {
        if (model !== 'mediafile') return;
        mockOrbitListeners.add(setRecords);
        return () => {
          mockOrbitListeners.delete(setRecords);
        };
      }, [model]);
      return records;
    },
  };
});

jest.mock('../../crud/tryFindRecord', () => ({
  findRecord: (_memory: unknown, _table: string, id: string) =>
    orbitMedia.find((m) => m.id === id),
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext({ state: { accessToken: 't' } }) };
});

const mockAxiosPost = jest.fn<() => Promise<unknown>>();
jest.mock('../../utils/axios', () => ({
  axiosGet: jest.fn(),
  axiosPost: () => mockAxiosPost(),
}));

jest.mock('../../hoc/SnackBar', () => ({
  AlertSeverity: { Error: 'error' },
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../crud/remoteId', () => ({
  remoteId: (_table: string, id: string) => id,
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [{ keyMap: {} }, jest.fn()],
}));

jest.mock('../../control', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  ActionRow: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../model', () => ({}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    aiEstimatedTime: 'Estimated time {0}',
    aiWillContinue: '{0} will continue',
    recognizeSpeech: 'Recognize speech',
    close: 'Close',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../selector', () => ({
  cardsSelector: jest.fn(),
  mainSelector: jest.fn(),
  playerSelector: jest.fn(),
  sharedSelector: jest.fn(),
  transcriberSelector: jest.fn(),
}));

jest.mock('./AeroTaskErrorMessage', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../utils', () => ({
  infoMsg: jest.fn(),
  logError: jest.fn(),
  Severity: { error: 'error' },
}));

jest.mock('../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({ getAsrSettings: () => undefined }),
}));

jest.mock(
  '../../components/PassageDetail/Internalization/useProjectSegmentSave',
  () => ({ useProjectSegmentSave: () => jest.fn() })
);

import AsrProgress from './AsrProgress';

const mediaWith = (duration: number) =>
  ({
    id: 'm1',
    type: 'mediafile',
    attributes: { duration, transcription: '', segments: '{}' },
  }) as unknown as MediaFileD;

const renderAsr = () =>
  render(
    <AsrProgress
      mediaId="m1"
      phonetic={false}
      setTranscription={jest.fn()}
      onPullTasks={jest.fn()}
      onClose={jest.fn()}
    />
  );

describe('AsrProgress estimated time', () => {
  beforeEach(() => {
    mockOrbitListeners.clear();
    // The transcription request stays in flight for the whole test.
    mockAxiosPost.mockReset();
    mockAxiosPost.mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    cleanup();
  });

  it('updates the estimate when the media record gains a new duration', () => {
    orbitMedia = [mediaWith(60)];
    renderAsr();
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'Estimated time ~0:45'
    );

    act(() => {
      orbitMedia[0].attributes.duration = 120;
      notifyOrbit();
    });

    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'Estimated time ~1:15'
    );
  });

  it('shows the fallback estimate while transcribing a recording with no stored duration', () => {
    orbitMedia = [mediaWith(0)];
    renderAsr();
    expect(mockAxiosPost).toHaveBeenCalled();
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'Estimated time ~0:15'
    );
  });
});
